@echo off
echo Checking Python installation...
python --version || (echo Python is not installed! && exit /b 1)
pip --version || (echo pip is not installed! && exit /b 1)

echo Installing required packages...
pip install -r requirements.txt

echo Checking for YOLO model...
if not exist yolov8n.pt (
    echo Model file yolov8n.pt not found in the current directory!
    echo Please make sure to place your YOLOv8n.pt model in this directory.
    exit /b 1
)

echo Starting detection server...
python app.py 