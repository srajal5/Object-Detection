from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import logging
import config
from detector import detector
import cv2
import numpy as np
import threading
import time
import re
from datetime import datetime
import os
import json
import bcrypt
import jwt
from functools import wraps
import requests
from pymongo import MongoClient
from bson.objectid import ObjectId
from flask_socketio import SocketIO, emit

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('api')

app = Flask(__name__)
# Update CORS configuration to allow credentials and specify origin
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Initialize MongoDB client
mongo_client = MongoClient(config.MONGODB_URI)
db = mongo_client[config.MONGODB_DB_NAME]

# Store current detection status
detection_active = False
monitoring_thread = None
monitoring_active = False
current_settings = None

# Global frame for video feed
latest_frame = None
latest_frame_lock = threading.Lock()

socketio = SocketIO(app, cors_allowed_origins=["http://localhost:3000"])

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # First try to get token from Authorization header
        token = request.headers.get('Authorization')
        if not token:
            # If not in header, try to get from cookies
            token = request.cookies.get('token')
            if not token:
                return jsonify({'message': 'Token is missing'}), 401
        else:
            # Remove 'Bearer ' prefix if present
            token = token.split(' ')[1] if token.startswith('Bearer ') else token
            
        try:
            data = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
            logger.info(f"Token payload: {data}")  # Add logging
            current_user = data
        except:
            return jsonify({'message': 'Token is invalid'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

def monitor_detector():
    """Monitor the detector's heartbeat and restart if necessary"""
    global detection_active, monitoring_active, current_settings
    
    logger.info("Detector monitoring thread started")
    
    while monitoring_active:
        try:
            if detection_active:
                # Update detector's heartbeat to show monitoring thread is active
                detector.heartbeat()
                
                # Check if detector is still running (if detection is marked as active)
                if not detector.is_running:
                    logger.error("Detector stopped unexpectedly while session is active")
                    
                    # Attempt to restart the detector with the same settings
                    if current_settings:
                        logger.info("Attempting to restart detector automatically")
                        try:
                            # Stop detector completely first
                            detector.stop_detection()
                            time.sleep(2)  # Give it time to clean up
                            
                            # Start detector with saved settings
                            success, message = detector.start_detection(current_settings)
                            if success:
                                logger.info("Detector restarted successfully")
                                # Re-register frame callback
                                detector.set_frame_callback(update_latest_frame)
                            else:
                                logger.error(f"Failed to restart detector: {message}")
                                # If we can't restart, mark detection as inactive
                                detection_active = False
                                clear_latest_frame()
                        except Exception as e:
                            logger.exception(f"Error restarting detector: {str(e)}")
                            detection_active = False
                            clear_latest_frame()
                
                # Log heartbeat status periodically
                heartbeat_age = detector.get_last_heartbeat_age()
                if heartbeat_age > detector.heartbeat_interval * 2:
                    logger.warning(f"Detector heartbeat age: {heartbeat_age:.1f}s (threshold: {detector.heartbeat_interval * 3}s)")
        except Exception as e:
            logger.exception(f"Error in detector monitoring thread: {str(e)}")
        
        # Sleep for a bit before checking again
        time.sleep(3)
    
    logger.info("Detector monitoring thread stopped")

def start_monitoring():
    """Start the detector monitoring thread"""
    global monitoring_thread, monitoring_active
    
    if monitoring_thread is None or not monitoring_thread.is_alive():
        monitoring_active = True
        monitoring_thread = threading.Thread(target=monitor_detector)
        monitoring_thread.daemon = True
        monitoring_thread.start()
        logger.info("Started detector monitoring thread")

def stop_monitoring():
    """Stop the detector monitoring thread"""
    global monitoring_active
    monitoring_active = False
    logger.info("Stopping detector monitoring thread")

def clear_latest_frame():
    """Clear the latest frame"""
    global latest_frame
    with latest_frame_lock:
        latest_frame = None

def generate_frames():
    """Generate frames for MJPEG streaming"""
    global latest_frame
    last_frame_time = time.time()
    frame_interval = 0.05  # Target 20 FPS (50ms between frames) instead of 30 FPS
    frame_skip = 0  # Counter for frame skipping
    max_frame_skip = 2  # Maximum number of frames to skip
    
    while True:
        current_time = time.time()
        time_since_last_frame = current_time - last_frame_time
        
        # Skip frames if we're falling behind
        if time_since_last_frame < frame_interval:
            frame_skip += 1
            if frame_skip > max_frame_skip:
                # If we've skipped too many frames, sleep briefly
                time.sleep(0.001)
            continue
            
        frame_skip = 0
        last_frame_time = current_time
            
        # If detection is not active or no frame is available, generate blank frame
        if not detection_active or latest_frame is None:
            # Create blank frame with text
            blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
            text = "Camera feed not available" if not detection_active else "Waiting for camera feed..."
            cv2.putText(blank_frame, text, (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            
            # Encode frame to JPEG with lower quality for faster transmission
            encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), 60]  # Reduced quality
            _, buffer = cv2.imencode('.jpg', blank_frame, encode_params)
            frame_bytes = buffer.tobytes()
            
            yield (b'--frame\r\n'
                  b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        else:
            # Acquire lock to access the latest frame
            with latest_frame_lock:
                if latest_frame is not None:
                    # Make a copy to avoid holding the lock during encoding
                    frame_to_encode = latest_frame.copy()
                
            if frame_to_encode is not None:
                # Resize frame if it's too large
                height, width = frame_to_encode.shape[:2]
                if width > 1280 or height > 720:
                    scale = min(1280/width, 720/height)
                    new_width = int(width * scale)
                    new_height = int(height * scale)
                    frame_to_encode = cv2.resize(frame_to_encode, (new_width, new_height))
                
                # Encode frame to JPEG with optimized settings
                encode_params = [
                    int(cv2.IMWRITE_JPEG_QUALITY), 60,  # Reduced quality
                    int(cv2.IMWRITE_JPEG_OPTIMIZE), 1,  # Enable JPEG optimization
                    int(cv2.IMWRITE_JPEG_PROGRESSIVE), 1  # Enable progressive JPEG
                ]
                _, buffer = cv2.imencode('.jpg', frame_to_encode, encode_params)
                frame_bytes = buffer.tobytes()
                
                yield (b'--frame\r\n'
                      b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    """Video streaming route"""
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/health', methods=['GET'])
def health_check():
    """API health check endpoint"""
    heartbeat_age = detector.get_last_heartbeat_age() if detection_active else None
    return jsonify({
        'status': 'healthy',
        'detection_active': detection_active,
        'monitoring_active': monitoring_active is True and (monitoring_thread is not None and monitoring_thread.is_alive()),
        'heartbeat_age': heartbeat_age
    })

@app.route('/start', methods=['POST'])
def start_detection():
    """Start object detection with provided settings"""
    global detection_active, current_settings
    
    if detection_active:
        logger.warning("Attempted to start detection when already running")
        return jsonify({
            'success': False,
            'message': 'Detection is already running'
        }), 400
    
    try:
        settings = request.json
        logger.info(f"Received start request with settings: {settings}")
        
        if not settings.get('ipCameraUrl'):
            logger.error("No camera URL provided in start request")
            return jsonify({
                'success': False,
                'message': 'Camera URL is required'
            }), 400
        
        # Force person detection only
        settings['classes'] = [0]  # Class 0 is person in COCO dataset
        settings['conf_threshold'] = 0.3  # Lower confidence threshold for faster detection
        settings['enablePersonDetection'] = True
        
        # Start detection with settings
        success, message = detector.start_detection(settings)
        
        if success:
            detection_active = True
            current_settings = settings.copy()
            start_monitoring()
            detector.set_frame_callback(update_latest_frame)
            logger.info("Detection started successfully with person-only mode")
            
            return jsonify({
                'success': True,
                'message': message
            }), 200
        else:
            logger.error(f"Failed to start detection: {message}")
            return jsonify({
                'success': False,
                'message': message
            }), 400
            
    except Exception as e:
        logger.exception(f"Error starting detection: {str(e)}")
        detection_active = False
        return jsonify({
            'success': False,
            'message': f"Server error: {str(e)}"
        }), 500

def send_ntfy_notification(topic, message, title="Person Detected", priority="high", tags="warning,person"):
    """Send notification to NTFY"""
    try:
        if not topic:
            logger.warning("No NTFY topic provided, skipping notification")
            return False
            
        # Get the IP camera URL from current settings
        camera_url = current_settings.get('ipCameraUrl') if current_settings else "Camera URL not available"
        camera_port = current_settings.get('ipCameraPort', '') if current_settings else ''
        
        # Construct the full camera URL with port
        if camera_url and camera_port:
            if not camera_url.startswith(('http://', 'https://')):
                camera_url = f"http://{camera_url}"
            camera_url = f"{camera_url}:{camera_port}/video"
        
        # Construct the notification message with camera URL
        full_message = f"{message}\n\nCamera Stream: {camera_url}"
        
        headers = {
            "Title": title,
            "Priority": priority,
            "Tags": tags,
            "Click": camera_url  # Make the notification clickable with the camera URL
        }
        
        response = requests.post(
            f"https://ntfy.sh/{topic}",
            data=full_message.encode('utf-8'),
            headers=headers
        )
        
        if response.status_code == 200:
            logger.info(f"Successfully sent NTFY notification to topic {topic}")
            return True
        else:
            logger.error(f"Failed to send NTFY notification. Status code: {response.status_code}")
            return False
            
    except Exception as e:
        logger.exception(f"Error sending NTFY notification: {str(e)}")
        return False

def update_latest_frame(frame_with_boxes):
    """Callback function to update the latest frame"""
    global latest_frame
    try:
        # Resize frame before storing if it's too large
        height, width = frame_with_boxes.shape[:2]
        if width > 640 or height > 480:
            scale = min(640/width, 480/height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            frame_with_boxes = cv2.resize(frame_with_boxes, (new_width, new_height))
            
        with latest_frame_lock:
            latest_frame = frame_with_boxes
            
        # Send NTFY notification if person is detected
        if current_settings and current_settings.get('enablePersonDetection'):
            ntfy_topic = current_settings.get('ntfyTopic')
            if ntfy_topic:
                send_ntfy_notification(
                    topic=ntfy_topic,
                    message="Person detected in camera feed",
                    title="Person Detected",
                    priority="high",
                    tags="warning,person"
                )

        # Create detection event data
        detection_data = {
            'user_id': current_settings.get('userId'),
            'object_type': 'person',
            'confidence': float(frame_with_boxes[frame_with_boxes.shape[0] // 2, frame_with_boxes.shape[1] // 2, 2]),
            'created_at': datetime.utcnow(),
            'person_count': 1  # Add person count
        }
        
        # Save to MongoDB and emit to clients
        emit_and_save_detection(detection_data)
            
    except Exception as e:
        logger.exception(f"Error updating frame: {str(e)}")

@app.route('/stop', methods=['POST'])
def stop_detection():
    """Stop the object detection process"""
    global detection_active, latest_frame, current_settings
    
    if not detection_active:
        logger.warning("Attempted to stop detection when not running")
        return jsonify({
            'success': False,
            'message': 'Detection is not running'
        }), 400
    
    try:
        logger.info("Stopping detection session")
        success, message = detector.stop_detection()
        
        if success:
            detection_active = False
            # Clear the latest frame and settings
            with latest_frame_lock:
                latest_frame = None
            current_settings = None
            logger.info("Detection stopped successfully")
            return jsonify({
                'success': True,
                'message': message
            }), 200
        else:
            logger.error(f"Failed to stop detection: {message}")
            return jsonify({
                'success': False,
                'message': message
            }), 400
            
    except Exception as e:
        logger.exception(f"Error stopping detection: {str(e)}")
        # Mark detection as stopped if there's an error
        detection_active = False
        current_settings = None
        return jsonify({
            'success': False,
            'message': f"Server error: {str(e)}"
        }), 500

@app.route('/status', methods=['GET'])
def get_status():
    """Get current detection status"""
    return jsonify({
        'detection_active': detection_active,
        'model_loaded': detector.model is not None
    })

@app.route('/api/test-camera', methods=['POST'])
def test_camera():
    """Test connection to camera"""
    try:
        data = request.json
        logger.info(f"Received camera test request: {data}")
        
        # Check if data is provided
        if not data:
            logger.error("No data provided in test-camera request")
            return jsonify({
                'success': False,
                'message': 'No camera data provided'
            }), 400
            
        # Extract camera source, URL and port
        camera_source = data.get('cameraSource', '')
        camera_url = data.get('ipCameraUrl', '')
        camera_port = data.get('ipCameraPort', '')
        
        # Log all received parameters
        logger.info(f"Received parameters - Source: {camera_source}, URL: {camera_url}, Port: {camera_port}")
        
        # Validate camera source
        if not camera_source:
            logger.error("No camera source provided")
            return jsonify({
                'success': False,
                'message': 'Camera source is required'
            }), 400
            
        # For IP camera, validate URL and port
        if camera_source == 'ip':
            if not camera_url:
                logger.error("No camera URL provided for IP camera")
                return jsonify({
                    'success': False,
                    'message': 'IP Camera URL is required'
                }), 400
                
            if not camera_port:
                logger.error("No camera port provided for IP camera")
                return jsonify({
                    'success': False,
                    'message': 'IP Camera Port is required'
                }), 400
                
            # Construct the full URL with port and /video
            if not camera_url.startswith(('http://', 'https://')):
                camera_url = f"http://{camera_url}"
            
            # Remove any trailing slashes
            camera_url = camera_url.rstrip('/')
            
            # Construct the full URL with port and /video
            stream_url = f"{camera_url}:{camera_port}/video"
            logger.info(f"Constructed stream URL: {stream_url}")
            
            # Try to open the camera stream with a timeout
            import cv2
            cap = cv2.VideoCapture(stream_url)
            
            # Set a timeout for the connection attempt
            cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)  # 5 second timeout
            
            if cap.isOpened():
                # Read a frame to confirm it's working
                ret, frame = cap.read()
                cap.release()
                
                if ret:
                    logger.info("Camera connection successful")
                    return jsonify({
                        'success': True,
                        'message': 'Camera connection successful'
                    }), 200
                else:
                    logger.error("Connected to camera but failed to read frame")
                    return jsonify({
                        'success': False,
                        'message': 'Connected to camera but failed to read frame. Please check if the camera is streaming.'
                    }), 400
            else:
                logger.error(f"Failed to connect to camera at {stream_url}")
                return jsonify({
                    'success': False,
                    'message': f'Failed to connect to camera at {stream_url}. Please verify the URL and port are correct.'
                }), 400
        else:
            logger.error(f"Unsupported camera source: {camera_source}")
            return jsonify({
                'success': False,
                'message': f'Unsupported camera source: {camera_source}'
            }), 400
            
    except Exception as e:
        logger.error(f"Error testing camera: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Error: {str(e)}"
        }), 500

@app.route('/api/detection/history', methods=['GET'])
@token_required
def get_detection_history(current_user):
    try:
        # Get query parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))

        logger.info(f"Fetching detection history for user {current_user}")
        logger.info(f"Query params: start_date={start_date}, end_date={end_date}, limit={limit}, offset={offset}")

        # Build query
        query = {'user_id': current_user.get('userId')}  # Changed from 'id' to 'userId' to match JWT payload
        
        if start_date:
            query['created_at'] = {'$gte': datetime.fromisoformat(start_date)}
        if end_date:
            query['created_at'] = {'$lte': datetime.fromisoformat(end_date)}
            
        logger.info(f"MongoDB query: {query}")
            
        # Execute query with pagination
        events = list(db.detection_events.find(query)
                     .sort('created_at', -1)
                     .skip(offset)
                     .limit(limit))
        
        logger.info(f"Found {len(events)} events")
        
        # Convert ObjectId to string for JSON serialization
        for event in events:
            event['_id'] = str(event['_id'])
            event['created_at'] = event['created_at'].isoformat()
        
        return jsonify({
            'success': True,
            'data': events,
            'count': len(events)
        })
    except Exception as e:
        logger.error(f"Error fetching detection history: {str(e)}")
        logger.exception("Full traceback:")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/detection/history/stats', methods=['GET'])
@token_required
def get_detection_stats(current_user):
    try:
        logger.info(f"Fetching detection stats for user {current_user}")
        
        # Get all events for the user
        query = {'user_id': current_user.get('userId')}  # Changed from 'id' to 'userId' to match JWT payload
        logger.info(f"MongoDB query: {query}")
        
        events = list(db.detection_events.find(query))
        logger.info(f"Found {len(events)} total events for stats")
        
        # Process data for stats
        daily_stats = {}
        total_detections = len(events)
        max_people = 0
        
        for event in events:
            date = event['created_at'].date().isoformat()
            if date not in daily_stats:
                daily_stats[date] = 0
            daily_stats[date] += 1
            
            if event.get('object_type') == 'person':
                max_people = max(max_people, event.get('confidence', 0))
        
        # Convert to array format for frontend
        daily_stats_array = [
            {'date': date, 'count': count}
            for date, count in daily_stats.items()
        ]
        
        logger.info(f"Processed stats: {len(daily_stats_array)} days, {total_detections} total detections")
        
        return jsonify({
            'success': True,
            'data': {
                'daily_stats': daily_stats_array,
                'total_detections': total_detections,
                'max_people_detected': max_people
            }
        })
    except Exception as e:
        logger.error(f"Error fetching detection stats: {str(e)}")
        logger.exception("Full traceback:")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/user/update-password', methods=['POST'])
@token_required
def update_password(current_user):
    try:
        data = request.get_json()
        current_password = data.get('currentPassword')
        new_password = data.get('newPassword')
        
        if not current_password or not new_password:
            return jsonify({
                'success': False,
                'error': 'Current password and new password are required'
            }), 400
            
        # Get user from database
        user = db.users.find_one({'_id': ObjectId(current_user['id'])})
        
        if not user:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
            
        # Verify current password
        if not bcrypt.checkpw(current_password.encode('utf-8'), user['password'].encode('utf-8')):
            return jsonify({
                'success': False,
                'error': 'Current password is incorrect'
            }), 401
            
        # Hash new password
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        
        # Update password in database
        db.users.update_one(
            {'_id': ObjectId(current_user['id'])},
            {
                '$set': {
                    'password': hashed_password.decode('utf-8'),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        return jsonify({
            'success': True,
            'message': 'Password updated successfully'
        })
    except Exception as e:
        logger.error(f"Error updating password: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@socketio.on('connect')
def handle_connect():
    logger.info('Client connected to SocketIO')

def emit_and_save_detection(detection_data):
    db.detection_events.insert_one(detection_data)
    socketio.emit('new_detection', detection_data)

@app.route('/api/user/profile', methods=['GET'])
@token_required
def get_user_profile(current_user):
    try:
        # Log the token payload for debugging
        logger.info(f"Token payload in get_user_profile: {current_user}")
        
        # Get user ID from token payload
        user_id = current_user.get('userId')
        if not user_id:
            return jsonify({'success': False, 'error': 'Invalid token payload'}), 401
        
        # Log the user ID and query
        logger.info(f"Looking up user with ID: {user_id}")
        query = {'_id': ObjectId(user_id)}
        logger.info(f"MongoDB query: {query}")
        
        # Check if the users collection exists
        collections = db.list_collection_names()
        logger.info(f"Available collections: {collections}")
        
        user = db.users.find_one(query)
        logger.info(f"Query result: {user}")
        
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'data': {
                'name': user.get('name', ''),
                'email': user.get('email', '')
            }
        })
    except Exception as e:
        logger.error(f"Error fetching user profile: {str(e)}")
        logger.exception("Full traceback:")
        return jsonify({'success': False, 'error': 'Failed to fetch user profile'}), 500

@app.route('/api/user/profile', methods=['PUT'])
@token_required
def update_user_profile(current_user):
    try:
        # Log the token payload for debugging
        logger.info(f"Token payload in update_user_profile: {current_user}")
        
        # Get user ID from token payload
        user_id = current_user.get('userId')
        if not user_id:
            logger.error("No userId in token payload")
            return jsonify({'success': False, 'error': 'Invalid token payload'}), 401
        
        # Log the request data
        data = request.get_json()
        logger.info(f"Update profile request data: {data}")
        
        # Validate required fields
        if not data:
            logger.error("No data in request body")
            return jsonify({'success': False, 'error': 'No data provided'}), 400
            
        if not data.get('name'):
            logger.error("Name is missing in request")
            return jsonify({'success': False, 'error': 'Name is required'}), 400
            
        if not data.get('email'):
            logger.error("Email is missing in request")
            return jsonify({'success': False, 'error': 'Email is required'}), 400
        
        # Validate email format
        if not re.match(r"[^@]+@[^@]+\.[^@]+", data['email']):
            logger.error(f"Invalid email format: {data['email']}")
            return jsonify({'success': False, 'error': 'Invalid email format'}), 400
        
        # Check if email is already taken by another user
        existing_user = db.users.find_one({
            'email': data['email'],
            '_id': {'$ne': ObjectId(user_id)}
        })
        
        if existing_user:
            logger.error(f"Email already in use: {data['email']}")
            return jsonify({'success': False, 'error': 'Email already in use'}), 400
        
        # Log the update query
        update_query = {
            '_id': ObjectId(user_id)
        }
        update_data = {
            '$set': {
                'name': data['name'],
                'email': data['email']
            }
        }
        logger.info(f"Update query: {update_query}")
        logger.info(f"Update data: {update_data}")
        
        # Update user profile
        result = db.users.update_one(update_query, update_data)
        
        logger.info(f"Update result: {result.raw_result}")
        
        if result.modified_count == 0:
            logger.error("No changes made to user profile")
            return jsonify({'success': False, 'error': 'No changes made'}), 400
        
        return jsonify({
            'success': True,
            'message': 'Profile updated successfully'
        })
    except Exception as e:
        logger.error(f"Error updating user profile: {str(e)}")
        logger.exception("Full traceback:")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    # Preload the model
    detector.load_model()
    
    # Start the Flask server
    socketio.run(app, host=config.FLASK_HOST, port=config.FLASK_PORT, debug=config.DEBUG) 