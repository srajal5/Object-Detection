import os
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

# API Configuration
FLASK_PORT = int(os.getenv('FLASK_PORT', 5000))
FLASK_HOST = os.getenv('FLASK_HOST', '0.0.0.0')
DEBUG = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'

# Model Configuration
MODEL_PATH = os.getenv('MODEL_PATH', 'yolo11m.pt')

# Confidence threshold for detections (0-1)
CONFIDENCE_THRESHOLD = float(os.getenv('CONFIDENCE_THRESHOLD', 0.5))

# Video stream buffer size
STREAM_BUFFER_SIZE = int(os.getenv('STREAM_BUFFER_SIZE', 10))

# Detection interval (in seconds)
DETECTION_INTERVAL = float(os.getenv('DETECTION_INTERVAL', 1.0))

# NTFY Configuration
NTFY_BASE_URL = os.getenv('NTFY_BASE_URL', 'https://ntfy.sh')

# Frontend URL for live feed
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

# MongoDB settings
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'object_detection')

# JWT settings
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key')  # Change this in production 