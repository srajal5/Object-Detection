# Object Detection Dashboard

A web application for managing and monitoring IP camera object detection with notification capabilities.

## Features

- User authentication (login/registration) using Supabase
- Detection Settings Dashboard:
  - IP Camera Configuration
  - NTFY Notification Configuration
  - Supabase Logging Configuration
  - Session Control (Start/Stop)
- Detection History Logs
- User Profile Management
- Python backend for YOLOv11m-based object detection

## Tech Stack

### Frontend

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Shadcn UI
- Supabase for authentication and database
- NTFY.sh for push notifications

### Backend

- Python 3.8+
- Flask REST API
- OpenCV for video processing
- Ultralytics YOLOv11m for object detection

## Project Structure

```
dashboard/                # Main project folder
├── src/                  # Next.js frontend code
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   └── lib/              # Utility functions and libraries
└── python-backend/       # Python backend for object detection
    ├── app.py            # Flask API server
    ├── detector.py       # YOLOv11m object detection module
    ├── config.py         # Backend configuration
    └── requirements.txt  # Python dependencies
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+ with pip
- Supabase account (for authentication and database)
- YOLOv11m.pt model file

### Frontend Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd dashboard
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory with the following variables:

   ```bash
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

   # Python Object Detection API Configuration
   NEXT_PUBLIC_DETECTION_API_URL=http://localhost:5000
   ```

   > **Development Mode**: If you don't provide valid Supabase credentials, the application will automatically run in development mode with mock authentication. This allows you to test and develop the application without setting up Supabase.

4. Set up Supabase:

   - Create a new project on [Supabase](https://supabase.com/)
   - Enable email authentication in Auth > Settings
   - Create the following tables in your Supabase database:

   **profiles table**:

   ```sql
   create table
     public.profiles (
       id uuid not null,
       full_name text null,
       created_at timestamp with time zone not null default now(),
       updated_at timestamp with time zone null,
       constraint profiles_pkey primary key (id),
       constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade
     ) tablespace pg_default;
   ```

   **detection_settings table**:

   ```sql
   create table
     public.detection_settings (
       id uuid not null default uuid_generate_v4(),
       user_id uuid not null,
       ip_camera_url text not null,
       ip_camera_port text not null,
       ntfy_topic text not null,
       ntfy_priority text null,
       supabase_url text null,
       supabase_key text null,
       enable_logging boolean null default false,
       created_at timestamp with time zone not null default now(),
       updated_at timestamp with time zone null,
       constraint detection_settings_pkey primary key (id),
       constraint detection_settings_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
     ) tablespace pg_default;
   ```

   **detection_events table**:

   ```sql
   create table
     public.detection_events (
       id uuid not null default uuid_generate_v4(),
       created_at timestamp with time zone not null default now(),
       user_id uuid not null,
       object_type text not null,
       confidence numeric not null,
       image_url text null,
       constraint detection_events_pkey primary key (id),
       constraint detection_events_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
     ) tablespace pg_default;
   ```

5. Run the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Python Backend Setup

1. Place your `yolo11m.pt` model file in the `python-backend` directory.

2. Install Python dependencies:

   ```bash
   cd python-backend
   pip install -r requirements.txt
   ```

3. Start the backend server:

   - On Windows: `start.bat`
   - On Linux/Mac: `bash start.sh`

## Development Mode

When running the application without valid Supabase credentials, it will operate in development mode with the following features:

- Mock authentication system that stores users in memory
- Simulated API responses for user data and detection events
- All form submissions and actions will work locally without a backend
- Look for console warnings indicating "Using mock Supabase implementation"

To use development mode:

1. Register with any email and password
2. Login with those credentials
3. All dashboard features will work with simulated data

This mode is perfect for UI development and testing without needing to set up a Supabase backend.

## Usage

1. Register an account or log in
2. Configure your IP camera settings
3. Set up NTFY notifications (create a unique topic)
4. Start a detection session to begin monitoring
5. View detection history in the History page

## NTFY Notifications

This project uses [ntfy.sh](https://ntfy.sh/) for push notifications. To receive notifications:

1. Enter a unique topic name in the NTFY configuration
2. Subscribe to your topic via:
   - Web: https://ntfy.sh/your-topic
   - Mobile app: Download the NTFY app and subscribe to your topic
   - Command line: `curl -s https://ntfy.sh/your-topic/json`

## Deployment

### Frontend

This application can be deployed on Vercel:

```bash
npm install -g vercel
vercel
```

### Backend

The Python backend needs to be hosted separately. Options include:

- A dedicated server or VPS running Python 3.8+
- A containerized solution with Docker
- Cloud services that support Python applications

Remember to set the `NEXT_PUBLIC_DETECTION_API_URL` environment variable in your frontend deployment to point to your hosted Python backend.

## License

MIT
