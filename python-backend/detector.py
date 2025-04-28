import cv2
import numpy as np
import time
from ultralytics import YOLO
import config
import logging
import requests
from datetime import datetime
import os
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('object_detector')

class ObjectDetector:
    def __init__(self):
        self.model = None
        self.is_running = False
        self.stream_url = None
        self.ntfy_topic = None
        self.ntfy_priority = "default"
        self.last_notification_time = {}  # To track when we last notified about each class
        self.notification_cooldown = 60  # seconds between notifications for the same object class
        self.cap = None
        self.user_id = None
        self.supabase_url = None
        self.supabase_key = None
        self.enable_logging = False
        self.frame_callback = None
        self.enable_person_detection = True  # Default to enabled
        self.last_heartbeat = 0  # Heartbeat timestamp
        self.heartbeat_interval = 5  # Seconds between heartbeats
        self.detected_persons = {}  # Track unique person detections
        self.person_detection_threshold = 0.7  # Confidence threshold for person detection
        self.person_tracking_timeout = 300  # 5 minutes to keep tracking a person before considering them "new" again
        self.last_notification_sent = 0  # Track when we last sent any notification
        self.min_notification_interval = 10  # Minimum seconds between notifications
        # IP Webcam specific settings
        self.is_ip_camera = False
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5
        self.reconnect_delay = 2  # seconds between reconnection attempts
        self.stream_quality = 80  # JPEG quality for IP camera streams (0-100)
        self.frame_buffer_size = 10  # Number of frames to buffer for IP cameras
        self.frame_buffer = []
        
    def heartbeat(self):
        """Update the heartbeat timestamp to indicate the detector is still alive"""
        self.last_heartbeat = time.time()
        logger.debug(f"Heartbeat updated: {self.last_heartbeat}")
        
    def get_last_heartbeat_age(self):
        """Get the age of the last heartbeat in seconds"""
        return time.time() - self.last_heartbeat
        
    def is_heartbeat_active(self):
        """Check if heartbeat is active (detector is alive)"""
        # Allow a grace period of 3x the interval for heartbeat
        max_age = self.heartbeat_interval * 3
        age = self.get_last_heartbeat_age()
        return age < max_age

    def set_frame_callback(self, callback):
        """Set a callback function to receive frames with detection boxes"""
        self.frame_callback = callback

    def load_model(self):
        """Load the YOLOv11m model"""
        try:
            model_path = config.MODEL_PATH
            logger.info(f"Loading model from {model_path}")
            self.model = YOLO(model_path)
            logger.info("Model loaded successfully")
            return True
        except Exception as e:
            logger.exception(f"Error loading model: {str(e)}")
            return False

    def start_detection(self, settings):
        """Start object detection with the given settings"""
        if self.is_running:
            logger.warning("Detection is already running")
            return False, "Detection is already running"

        # Set initial heartbeat
        self.heartbeat()
        
        # Extract settings
        camera_url = settings.get('ipCameraUrl', '')
        camera_port = settings.get('ipCameraPort', '')
        
        # Handle webcam URL format (webcam://0, webcam://1, etc.)
        if camera_url.startswith('webcam://'):
            try:
                # Extract webcam index from URL (default to 0 if not provided or invalid)
                webcam_index = int(camera_url.replace('webcam://', '') or 0)
                logger.info(f"Using local webcam with index: {webcam_index}")
                self.stream_url = webcam_index
                self.is_ip_camera = False
            except ValueError:
                logger.error(f"Invalid webcam index: {camera_url.replace('webcam://', '')}")
                self.stream_url = 0
                self.is_ip_camera = False
        # Form the stream URL based on protocol
        elif camera_url.startswith(('rtmp://', 'srt://')):
            # For RTMP and SRT, use the URL as is or append port if specified
            self.stream_url = f"{camera_url}:{camera_port}" if camera_port and ':' not in camera_url else camera_url
            self.is_ip_camera = False
        elif not camera_url.startswith(('http://', 'https://')):
            # For HTTP streams without protocol prefix, add it
            camera_url = f"http://{camera_url}"
            self.stream_url = f"{camera_url}:{camera_port}" if camera_port else camera_url
            self.is_ip_camera = True
        else:
            # For URLs with protocol already specified
            self.stream_url = f"{camera_url}:{camera_port}" if camera_port and ':' not in camera_url else camera_url
            self.is_ip_camera = True
            
        logger.info(f"Camera stream URL: {self.stream_url} (IP Camera: {self.is_ip_camera})")
        
        # Set IP camera specific settings
        if self.is_ip_camera:
            self.stream_quality = settings.get('streamQuality', 80)
            self.frame_buffer_size = settings.get('frameBufferSize', 10)
            logger.info(f"IP Camera settings - Quality: {self.stream_quality}, Buffer Size: {self.frame_buffer_size}")
        
        self.ntfy_topic = settings.get('ntfyTopic')
        self.ntfy_priority = settings.get('ntfyPriority', 'default')
        self.enable_person_detection = settings.get('enablePersonDetection', True)
        logger.info(f"Person detection notifications: {'Enabled' if self.enable_person_detection else 'Disabled'}")
        
        self.user_id = settings.get('userId', 'unknown-user')
        self.supabase_url = settings.get('supabaseUrl')
        self.supabase_key = settings.get('supabaseKey')
        self.enable_logging = settings.get('enableLogging', False)

        # Load model if not already loaded
        if self.model is None and not self.load_model():
            return False, "Failed to load detection model"

        # Open video stream
        try:
            logger.info(f"Opening video stream: {self.stream_url}")
            self.cap = cv2.VideoCapture(self.stream_url)
            
            # Set IP camera specific parameters
            if self.is_ip_camera:
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, self.frame_buffer_size)
                # Try to set lower resolution for IP cameras to reduce bandwidth
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            
            if not self.cap.isOpened():
                logger.error("Failed to open video stream")
                return False, "Failed to open video stream"
                
            # Reset reconnect attempts counter
            self.reconnect_attempts = 0
        except Exception as e:
            logger.exception(f"Error opening video stream: {str(e)}")
            return False, f"Error opening video stream: {str(e)}"

        # Start detection
        self.is_running = True
        logger.info("Detection started")

        # Run detection in a separate thread to not block the response
        import threading
        detection_thread = threading.Thread(target=self.detection_loop)
        detection_thread.daemon = True
        detection_thread.start()

        return True, "Detection started successfully"

    def stop_detection(self):
        """Stop the object detection process"""
        if not self.is_running:
            return False, "Detection is not running"

        self.is_running = False
        if self.cap is not None:
            self.cap.release()
            self.cap = None

        logger.info("Detection stopped")
        return True, "Detection stopped successfully"

    def detection_loop(self):
        """Main detection loop"""
        logger.info("Detection loop started")
        last_detection_time = 0
        consecutive_errors = 0
        max_consecutive_errors = 10  # Increased from 5 to be more tolerant of errors

        while self.is_running:
            try:
                # Check if enough time has passed since last detection
                current_time = time.time()
                if current_time - last_detection_time < config.DETECTION_INTERVAL:
                    time.sleep(0.1)  # Short sleep to prevent CPU hogging
                    continue

                # Read frame from camera (with timeout handling)
                if self.cap is None or not self.cap.isOpened():
                    logger.warning("Camera not open, attempting to reconnect...")
                    try:
                        if self.cap is not None:
                            self.cap.release()
                        
                        # For IP cameras, implement exponential backoff
                        if self.is_ip_camera:
                            wait_time = min(self.reconnect_delay * (2 ** self.reconnect_attempts), 30)
                            logger.info(f"Waiting {wait_time} seconds before reconnection attempt {self.reconnect_attempts + 1}")
                            time.sleep(wait_time)
                        
                        self.cap = cv2.VideoCapture(self.stream_url)
                        
                        # Set IP camera specific parameters after reconnection
                        if self.is_ip_camera:
                            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, self.frame_buffer_size)
                            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                        
                        # Wait for connection to establish
                        time.sleep(1)
                        
                        # Check if reconnection was successful
                        if not self.cap.isOpened():
                            self.reconnect_attempts += 1
                            logger.error(f"Reconnection attempt {self.reconnect_attempts}/{self.max_reconnect_attempts} failed")
                            
                            if self.reconnect_attempts >= self.max_reconnect_attempts:
                                logger.error(f"Failed to reconnect after {self.max_reconnect_attempts} attempts, stopping detection")
                                self.is_running = False
                                break
                                
                            continue
                        else:
                            # Reset counter on successful reconnection
                            self.reconnect_attempts = 0
                            logger.info("Successfully reconnected to camera")
                    except Exception as e:
                        logger.exception(f"Error reconnecting to camera: {str(e)}")
                        time.sleep(2)  # Wait before retrying
                    continue

                # Attempt to read a frame with timeout protection
                frame_read_success = False
                ret, frame = None, None
                
                try:
                    # Set a timeout for frame reading
                    start_time = time.time()
                    ret, frame = self.cap.read()
                    if time.time() - start_time > 10:  # If frame reading takes more than 10 seconds
                        logger.warning("Frame reading took too long, may be stuck")
                        # Force a reconnection
                        if self.cap is not None:
                            self.cap.release()
                            self.cap = None
                        continue
                        
                    frame_read_success = True
                except Exception as e:
                    logger.exception(f"Exception during frame reading: {str(e)}")
                
                if not frame_read_success or not ret or frame is None:
                    logger.warning("Failed to read frame from stream")
                    consecutive_errors += 1
                    logger.debug(f"Consecutive frame read errors: {consecutive_errors}/{max_consecutive_errors}")
                    
                    if consecutive_errors >= max_consecutive_errors:
                        logger.error(f"Too many consecutive frame read errors ({consecutive_errors}), attempting camera reconnection")
                        consecutive_errors = 0
                        # Force reconnection
                        try:
                            if self.cap is not None:
                                self.cap.release()
                            time.sleep(2)  # Wait before reconnecting
                            self.cap = cv2.VideoCapture(self.stream_url)
                            logger.info("Camera reconnection attempted")
                        except Exception as e:
                            logger.exception(f"Error during camera reconnection: {str(e)}")
                    
                    time.sleep(1)  # Wait before next attempt
                    continue
                
                # Reset error counter on successful frame read
                consecutive_errors = 0
                last_detection_time = current_time

                # Run detection
                try:
                    results = self.model(frame, conf=config.CONFIDENCE_THRESHOLD)
                    
                    # Process results
                    detections = []
                    # Create a copy of the frame for drawing boxes
                    frame_with_boxes = frame.copy()
                    
                    # Initialize person counter
                    person_count = 0
                    
                    for r in results:
                        boxes = r.boxes
                        for box in boxes:
                            try:
                                cls_id = int(box.cls.item())
                                conf = float(box.conf.item())
                                cls_name = self.model.names[cls_id]
                                
                                # Only process person detections
                                if cls_name.lower() != 'person':
                                    continue
                                    
                                # Increment person counter
                                person_count += 1
                                    
                                xyxy = box.xyxy.tolist()[0]  # Get box coordinates
                                
                                # Draw bounding box
                                x1, y1, x2, y2 = map(int, xyxy)
                                color = (0, 255, 0)  # Green color for box
                                cv2.rectangle(frame_with_boxes, (x1, y1), (x2, y2), color, 2)
                                
                                # Add label
                                label = f"{cls_name}: {conf:.2f}"
                                cv2.putText(frame_with_boxes, label, (x1, y1 - 10), 
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                                
                                detections.append({
                                    'class': cls_name,
                                    'confidence': conf,
                                    'box': xyxy
                                })
                            except Exception as e:
                                logger.error(f"Error processing detection box: {str(e)}")
                                continue
                    
                    # Add timestamp and person count to the frame
                    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    cv2.putText(frame_with_boxes, f"Time: {timestamp}", (10, 30), 
                              cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                    cv2.putText(frame_with_boxes, f"People Detected: {person_count}", (10, 60), 
                              cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                    
                    # Send frame to callback if available
                    if self.frame_callback and frame_with_boxes is not None:
                        try:
                            # Resize frame for streaming (to reduce bandwidth)
                            h, w = frame_with_boxes.shape[:2]
                            max_dim = 480  # Reduced from 640 for better performance
                            if max(h, w) > max_dim:
                                scale = max_dim / max(h, w)
                                new_h, new_w = int(h * scale), int(w * scale)
                                # Use INTER_AREA for downsampling (better quality for streaming)
                                frame_with_boxes = cv2.resize(frame_with_boxes, (new_w, new_h), 
                                                            interpolation=cv2.INTER_AREA)
                            
                            # Skip frames to reduce processing load
                            current_ms = int(time.time() * 1000)
                            if not hasattr(self, '_last_callback_time') or current_ms - getattr(self, '_last_callback_time', 0) >= 33:  # ~30fps
                                self.frame_callback(frame_with_boxes)
                                self._last_callback_time = current_ms
                        except Exception as e:
                            logger.exception(f"Error in frame callback: {str(e)}")
                    
                    # Send notifications and log detections
                    if detections:
                        try:
                            # Add person count to the notification
                            self.process_detections(detections, frame, person_count)
                        except Exception as e:
                            logger.exception(f"Error processing detections: {str(e)}")
                
                except Exception as e:
                    logger.exception(f"Error during detection: {str(e)}")
                    time.sleep(0.5)  # Add short delay to prevent rapid error loops
            
            except Exception as e:
                logger.exception(f"Critical error in detection loop: {str(e)}")
                time.sleep(1)  # Add delay to prevent rapid error loops
        
        # Record exit reason        
        logger.info(f"Detection loop ended. is_running={self.is_running}")
        
        # Clean up resources when loop ends
        try:
            if self.cap is not None:
                self.cap.release()
                self.cap = None
        except Exception as e:
            logger.exception(f"Error releasing camera: {str(e)}")

    def is_new_person_detection(self, box, confidence):
        """Check if this is a new person detection based on position and confidence"""
        if confidence < self.person_detection_threshold:
            return False
            
        # Get box coordinates
        x1, y1, x2, y2 = box
        
        # Create a unique identifier for this detection
        # Use the center point of the bounding box
        center_x = (x1 + x2) / 2
        center_y = (y1 + y2) / 2
        
        # Check if we've seen this person recently
        current_time = time.time()
        
        # Check if we're sending notifications too frequently
        if current_time - self.last_notification_sent < self.min_notification_interval:
            return False
            
        # Check if this person matches any previously detected person
        for person_id, (last_seen, pos) in list(self.detected_persons.items()):
            last_x, last_y = pos
            
            # Calculate distance between current and last position
            distance = ((center_x - last_x) ** 2 + (center_y - last_y) ** 2) ** 0.5
            
            # If person is close to a previously detected position and within timeout
            if distance < 100 and current_time - last_seen < self.person_tracking_timeout:
                # Update the last seen time and position
                self.detected_persons[person_id] = (current_time, (center_x, center_y))
                return False
        
        # This is a new person detection
        person_id = f"person_{len(self.detected_persons)}"
        self.detected_persons[person_id] = (current_time, (center_x, center_y))
        self.last_notification_sent = current_time
        return True

    def process_detections(self, detections, frame, person_count):
        """Process detections by sending notifications and logging to Supabase"""
        current_time = time.time()
        new_person_detected = False
        
        for detection in detections:
            object_class = detection['class']
            confidence = detection['confidence']
            box = detection['box']
            
            # Check for new person detections
            if object_class.lower() == 'person' and self.enable_person_detection:
                if self.is_new_person_detection(box, confidence):
                    new_person_detected = True
                    # Send notification for new person
                    if self.ntfy_topic:
                        self.send_notification(object_class, confidence, person_count, is_priority=True)
                    # Log person detection to Supabase if enabled
                    if self.enable_logging and self.supabase_url and self.supabase_key:
                        self.log_detection(object_class, confidence, person_count)
                continue
            
            # For other objects, check the cooldown period
            if (object_class not in self.last_notification_time or 
                current_time - self.last_notification_time.get(object_class, 0) > self.notification_cooldown):
                
                # Send notification
                if self.ntfy_topic:
                    self.send_notification(object_class, confidence, person_count)
                    self.last_notification_time[object_class] = current_time
                
                # Log to Supabase if enabled
                if self.enable_logging and self.supabase_url and self.supabase_key:
                    self.log_detection(object_class, confidence, person_count)
        
        # Clean up old detections
        self._cleanup_old_detections()
    
    def _cleanup_old_detections(self):
        """Remove old person detections from tracking"""
        current_time = time.time()
        for person_id, (last_seen, _) in list(self.detected_persons.items()):
            if current_time - last_seen > self.person_tracking_timeout:
                del self.detected_persons[person_id]

    def send_notification(self, object_class, confidence, person_count, is_priority=False):
        """Send a notification using NTFY"""
        try:
            # Get the live feed URL
            live_feed_url = f"{config.FRONTEND_URL}/dashboard"  # Adjust this based on your frontend URL
            
            # Special handling for person detection
            if object_class.lower() == 'person':
                title = "Person Detected!"  # Remove emoji characters that cause encoding issues
                message = f"{person_count} person(s) detected with {confidence:.2%} confidence\nView live feed: {live_feed_url}"
                priority = "urgent"  # Set higher priority for person detections
                tags = "warning,eyes,bell"
            else:
                title = f"Object Detected: {object_class}"
                message = f"Detected {object_class} with {confidence:.2%} confidence\nView live feed: {live_feed_url}"
                priority = self.ntfy_priority if not is_priority else "high"
                tags = "warning"
            
            # Add timestamp to the message
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            message = f"[{timestamp}] {message}"
            
            # Use only ASCII characters in headers to avoid encoding issues
            headers = {
                "Title": title,
                "Priority": priority,
                "Tags": tags,
                "Content-Type": "text/plain; charset=utf-8",  # Ensure UTF-8 content type
                "Click": live_feed_url  # Add click action to open the live feed
            }
            
            # Support full URL or base+topic
            if self.ntfy_topic.startswith(("http://", "https://")):
                url = self.ntfy_topic
            else:
                base = config.NTFY_BASE_URL.rstrip("/")
                topic = self.ntfy_topic.lstrip("/")
                url = f"{base}/{topic}"
            
            # Ensure we're using utf-8 for the message body
            message_bytes = message.encode('utf-8')
            
            # Use the requests library with proper encoding
            response = requests.post(
                url, 
                data=message_bytes,
                headers=headers
            )
            
            if response.status_code == 200:
                logger.info(f"Notification sent for {object_class}")
            else:
                logger.error(f"Failed to send notification: {response.status_code} - {response.text}")
        
        except Exception as e:
            logger.error(f"Error sending notification: {str(e)}")
            # Log more details to help diagnose the issue
            import traceback
            logger.debug(f"Notification error details: {traceback.format_exc()}")

    def log_detection(self, object_class, confidence, person_count):
        """Log detection to Supabase"""
        try:
            timestamp = datetime.now().isoformat()
            
            headers = {
                "apikey": self.supabase_key,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            }
            
            data = {
                "created_at": timestamp,
                "user_id": self.user_id,
                "object_type": object_class,
                "confidence": confidence,
                "person_count": person_count
            }
            
            url = f"{self.supabase_url}/rest/v1/detection_events"
            response = requests.post(url, json=data, headers=headers)
            
            if response.status_code in (201, 200):
                logger.info(f"Detection logged to Supabase: {object_class}")
            else:
                logger.error(f"Failed to log detection: {response.status_code} - {response.text}")
        
        except Exception as e:
            logger.error(f"Error logging detection: {str(e)}")

# Create a singleton instance
detector = ObjectDetector() 