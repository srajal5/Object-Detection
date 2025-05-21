# Object Detection Dashboard

A web application for real-time object detection using computer vision with a modern dashboard interface.

## Features

- Real-time video feed with object detection
- Detection Settings Dashboard:
  - Multiple camera source options (System Default, IP Camera, Physical Cameras)
  - Camera connection testing
  - NTFY Notification Configuration
  - Advanced settings (logging, person detection, stream quality)
  - Session Control (Start/Stop)
- Detection History with:
  - Interactive timeline view
  - Detailed detection logs
  - Statistics and trends
  - Date range filtering
  - Auto-refresh capability
- User Profile Management
- Python backend for YOLOv8-based object detection

## Tech Stack

### Frontend

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Shadcn UI
- Material-UI (MUI)
- Recharts for data visualization
- Date-fns for date handling

### Backend

- Python 3.8+
- Flask REST API
- OpenCV for video processing
- Ultralytics YOLOv8 for object detection
- NTFY.sh for push notifications

## Project Structure

```
ObjectDetection/           # Main project folder
├── src/                   # Next.js frontend code
│   ├── app/              # Next.js app router pages
│   │   ├── auth/        # Authentication pages
│   │   └── dashboard/   # Dashboard pages
│   ├── components/      # React components
│   │   ├── auth/       # Authentication components
│   │   ├── dashboard/  # Dashboard components
│   │   └── ui/         # UI components
│   └── lib/            # Utility functions and libraries
└── python-backend/      # Python backend for object detection
    ├── app.py          # Flask API server
    ├── detector.py     # YOLOv8 object detection module
    ├── config.py       # Backend configuration
    └── requirements.txt # Python dependencies
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+ with pip
- Webcam or IP camera
- YOLOv8 model file

### Frontend Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ObjectDetection
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory:
   ```bash
   NEXT_PUBLIC_DETECTION_API_URL=http://localhost:5000
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Python Backend Setup

1. Install Python dependencies:
   ```bash
   cd python-backend
   pip install -r requirements.txt
   ```

2. Start the backend server:
   ```bash
   python app.py
   ```

## Usage

1. Access the dashboard at http://localhost:3000/dashboard
2. Configure your camera settings:
   - Choose camera source (System Default, IP Camera, or Physical Camera)
   - Test camera connection
   - Adjust stream quality and frame buffer size
3. Configure notifications (optional):
   - Set up NTFY topic for push notifications
   - Choose notification priority
4. Start detection:
   - Click "Start Detection" to begin monitoring
   - View real-time detections in the video feed
   - Monitor detection history and statistics
5. View detection history:
   - Filter by date range
   - View detection trends
   - Check detailed detection logs
   - Enable auto-refresh for real-time updates

## NTFY Notifications

This project uses [ntfy.sh](https://ntfy.sh/) for push notifications. To receive notifications:

1. Enter a unique topic name in the NTFY configuration
2. Subscribe to your topic via:
   - Web: https://ntfy.sh/your-topic
   - Mobile app: Download the NTFY app and subscribe to your topic
   - Command line: `curl -s https://ntfy.sh/your-topic/json`

## Development

The project uses modern development practices:

- TypeScript for type safety
- ESLint and Prettier for code formatting
- Component-based architecture
- Responsive design with Tailwind CSS
- Real-time updates with auto-refresh
- Error handling and loading states

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
