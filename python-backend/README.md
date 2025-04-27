# Object Detection Backend

This is the Python backend for the Object Detection Dashboard. It uses YOLOv11m for object detection from IP camera feeds and provides APIs for the frontend to control detection sessions.

## Features

- YOLOv11m object detection model integration
- IP camera feed processing
- NTFY.sh notification integration
- Supabase logging integration
- REST API for controlling detection sessions

## Setup

### Prerequisites

- Python 3.8+
- pip
- Your YOLOv11m.pt model file

### Installation

1. Place your `yolo11m.pt` model file in this directory.

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Run the server:
   - On Windows: `start.bat`
   - On Linux/Mac: `bash start.sh`

## API Endpoints

The backend exposes the following API endpoints:

- `GET /health` - Check server health
- `GET /status` - Get current detection status
- `POST /start` - Start a detection session with configuration
- `POST /stop` - Stop the current detection session
- `POST /test-camera` - Test connection to an IP camera

## Configuration

You can configure the backend by modifying the `config.py` file or by setting environment variables:

- `FLASK_PORT` - Port for the Flask server (default: 5000)
- `MODEL_PATH` - Path to the YOLOv11m model file (default: yolo11m.pt)
- `CONFIDENCE_THRESHOLD` - Confidence threshold for detections (default: 0.5)
- `DETECTION_INTERVAL` - Seconds between detection runs (default: 1.0)
- `NTFY_BASE_URL` - Base URL for NTFY notifications (default: https://ntfy.sh)

## Integration with the Frontend

The frontend sends configuration to the backend when starting a detection session, including:

- IP camera URL and port
- NTFY topic and priority
- Supabase credentials for logging (optional)

## Troubleshooting

Common issues:

1. **Model not found**: Ensure your `yolo11m.pt` file is in the same directory as the app.py file.

2. **Camera connection issues**: Verify your IP camera URL and port are correct. Make sure the camera is accessible from the server running the backend.

3. **Dependencies issues**: If you encounter errors with dependencies, try creating a virtual environment:
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   source venv/bin/activate  # Linux/Mac
   pip install -r requirements.txt
   ```
