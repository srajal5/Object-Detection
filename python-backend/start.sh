#!/bin/bash

# Check if Python and pip are installed
python3 --version || { echo "Python 3 is not installed!"; exit 1; }
pip3 --version || { echo "pip is not installed!"; exit 1; }

echo "Installing required packages..."
pip3 install -r requirements.txt

# Check if the model exists
if [ ! -f yolov8n.pt ]; then
    echo "Model file yolov8n.pt not found in the current directory!"
    echo "Please make sure to place your YOLOv8n.pt model in this directory."
    exit 1
fi

echo "Starting detection server..."
python3 app.py 