#!/bin/bash

# Check if Python and pip are installed
python3 --version || { echo "Python 3 is not installed!"; exit 1; }
pip3 --version || { echo "pip is not installed!"; exit 1; }

echo "Installing required packages..."
pip3 install -r requirements.txt

# Check if the model exists
if [ ! -f yolo11m.pt ]; then
    echo "Model file yolo11m.pt not found in the current directory!"
    echo "Please make sure to place your YOLOv11m.pt model in this directory."
    exit 1
fi

echo "Starting detection server..."
python3 app.py 