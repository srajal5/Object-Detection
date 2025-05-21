# Real-Time Object Detection System

A modern web application that performs real-time object detection using YOLOv8 and provides a user-friendly interface for monitoring and managing detections.

## 🌟 Features

- **Real-time Object Detection**: Powered by YOLOv8 for accurate and fast detection
- **User Authentication**: Secure login and registration system
- **Profile Management**: Update and manage user profiles
- **Live Video Feed**: Real-time video streaming with detection overlays
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Dark Mode Support**: Comfortable viewing in any lighting condition

## 🚀 Tech Stack

### Frontend
- React 18
- TypeScript
- Material-UI
- WebSocket for real-time communication
- Axios for API requests

### Backend
- Python 3.8+
- Flask
- YOLOv8 (Ultralytics)
- OpenCV
- WebSocket support

## 🛠️ Installation

### Prerequisites
- Node.js (v14 or higher)
- Python 3.8 or higher
- Git

### Frontend Setup
```bash
# Clone the repository
git clone https://github.com/srajal5/Object-Detection.git

# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Backend Setup
```bash
# Navigate to backend directory
cd python-backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Unix or MacOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
python app.py
```

## 📝 Environment Variables

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000
```

### Backend (.env)
```
MODEL_PATH=yolov8n.pt
CONFIDENCE_THRESHOLD=0.3
```

## 🎯 Usage

1. Register a new account or login with existing credentials
2. Access the dashboard to view the live video feed
3. The system will automatically detect objects in the video stream
4. Update your profile information as needed
5. Monitor detection results in real-time

## 🔧 Configuration

- Adjust detection confidence threshold in `config.py`
- Modify video stream settings in `detector.py`
- Customize UI theme in frontend components

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Srajal** - *Initial work* - [srajal5](https://github.com/srajal5)

## 🙏 Acknowledgments

- YOLOv8 team for the amazing object detection model
- Flask team for the backend framework
- React team for the frontend framework
- All contributors who have helped improve this project

## 📞 Support

If you encounter any issues or have questions, please:
1. Check the [Issues](https://github.com/srajal5/Object-Detection/issues) page
2. Create a new issue if your problem isn't already listed
3. Provide detailed information about your problem

## 🔄 Updates

- Added user authentication system
- Implemented profile management
- Enhanced video streaming performance
- Added dark mode support
- Improved error handling and user feedback

---

Made with by Srajal and Siddharth dev
