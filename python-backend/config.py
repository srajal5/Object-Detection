import os
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

# API Configuration
FLASK_PORT = int(os.getenv('FLASK_PORT', 5000))
DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 't')

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