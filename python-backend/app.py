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
    frame_interval = 0.033  # Target ~30 FPS (33ms between frames)
    
    while True:
        # Control frame rate to avoid overwhelming the network
        current_time = time.time()
        time_since_last_frame = current_time - last_frame_time
        
        if time_since_last_frame < frame_interval:
            # Sleep just enough time to maintain target frame rate
            sleep_time = max(0.001, frame_interval - time_since_last_frame)
            time.sleep(sleep_time)
            continue
            
        last_frame_time = current_time
            
        # If detection is not active or no frame is available, generate blank frame
        if not detection_active or latest_frame is None:
            # Create blank frame with text
            blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
            text = "Camera feed not available" if not detection_active else "Waiting for camera feed..."
            cv2.putText(blank_frame, text, (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            
            # Encode frame to JPEG with optimized quality
            encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), 80]  # Lower quality for faster transmission
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
                # Encode frame to JPEG with optimized quality
                encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), 80]  # Lower quality for faster transmission
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
    
    # Get settings from request body
    try:
        settings = request.json
        logger.info(f"Received start request with settings: {settings}")
        
        # Validate that camera URL is provided
        if not settings.get('ipCameraUrl'):
            logger.error("No camera URL provided in start request")
            return jsonify({
                'success': False,
                'message': 'Camera URL is required'
            }), 400
        
        # If NTFY topic is provided but empty, warn the user
        if 'ntfyTopic' in settings and not settings.get('ntfyTopic'):
            logger.warning("Empty NTFY topic provided - notifications will not be sent")
            
        # Check if person detection notification is enabled
        settings['enablePersonDetection'] = settings.get('enablePersonDetection', True)
        if settings['enablePersonDetection']:
            logger.info("Person detection notifications are enabled")
        
        # Extract user ID from Supabase auth if available
        if request.headers.get('Authorization'):
            auth_token = request.headers.get('Authorization').replace('Bearer ', '')
            # In a real app, you would validate this token with Supabase
            # and extract the user ID
            settings['userId'] = 'user-from-token'
            
        # Start detection with settings
        success, message = detector.start_detection(settings)
        
        if success:
            detection_active = True
            # Save the current settings for potential restart
            current_settings = settings.copy()
            
            # Start monitoring thread if not already running
            start_monitoring()
            
            # Register callback to receive frames
            detector.set_frame_callback(update_latest_frame)
            logger.info("Detection started successfully")
            
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
        # Ensure detection is marked as stopped if an error occurs
        detection_active = False
        return jsonify({
            'success': False,
            'message': f"Server error: {str(e)}"
        }), 500

def update_latest_frame(frame_with_boxes):
    """Callback function to update the latest frame"""
    global latest_frame
    try:
        with latest_frame_lock:
            latest_frame = frame_with_boxes
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

if __name__ == '__main__':
    # Preload the model
    detector.load_model()
    
    # Start the Flask server
    app.run(
        host='0.0.0.0',
        port=config.FLASK_PORT,
        debug=config.DEBUG
    ) 