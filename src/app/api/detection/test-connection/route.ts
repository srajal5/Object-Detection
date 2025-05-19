import { NextResponse } from 'next/server';
import axios from 'axios';

const DETECTION_API_URL = process.env.DETECTION_API_URL || 'https://object-detection-backend.vercel.app';

interface TestConnectionRequestBody {
  cameraSource: string;
  url?: string;
  port?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received request body:', body);

    // Validate required fields
    if (!body.cameraSource) {
      return NextResponse.json(
        { message: 'Camera source is required' },
        { status: 400 }
      );
    }

    // Prepare request body for detection service
    const testConnectionBody: TestConnectionRequestBody = {
      cameraSource: body.cameraSource,
    };

    // Handle different camera sources
    switch (body.cameraSource) {
      case 'ip':
        if (!body.ipCameraUrl?.trim()) {
          return NextResponse.json(
            { message: 'IP Camera URL is required' },
            { status: 400 }
          );
        }
        if (!body.ipCameraPort?.trim()) {
          return NextResponse.json(
            { message: 'IP Camera Port is required' },
            { status: 400 }
          );
        }

        // Ensure URL has http:// prefix and remove any trailing slashes
        let cameraUrl = body.ipCameraUrl.trim();
        if (!cameraUrl.startsWith('http://') && !cameraUrl.startsWith('https://')) {
          cameraUrl = `http://${cameraUrl}`;
        }
        cameraUrl = cameraUrl.replace(/\/+$/, '');

        // Remove any existing port from the URL
        cameraUrl = cameraUrl.replace(/:\d+(\/|$)/, '');

        testConnectionBody.url = cameraUrl;
        testConnectionBody.port = body.ipCameraPort;
        break;

      case 'default':
        // For system default camera
        testConnectionBody.url = 'webcam://0';
        testConnectionBody.port = '0';
        break;

      case 'cameo':
        // For Cameo Studio
        testConnectionBody.url = 'webcam://1';
        testConnectionBody.port = '0';
        break;

      default:
        // For physical cameras
        if (body.cameraSource.startsWith('camera-') || body.cameraSource.includes('videoinput')) {
          testConnectionBody.url = `webcam://${body.cameraSource}`;
          testConnectionBody.port = '0';
        } else {
          return NextResponse.json(
            { message: 'Invalid camera source' },
            { status: 400 }
          );
        }
    }

    console.log('Sending to detection service:', testConnectionBody);

    // Forward the request to the detection service
    const response = await axios.post(`${DETECTION_API_URL}/api/test-camera`, testConnectionBody);
    console.log('Detection service response:', response.data);
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error testing connection:', error);
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Detection service error response:', error.response.data);
      return NextResponse.json(
        { message: error.response.data?.message || 'Failed to test connection' },
        { status: error.response.status }
      );
    } else if (error.request) {
      // The request was made but no response was received
      return NextResponse.json(
        { message: 'No response from detection service. Please check if the backend service is running.' },
        { status: 503 }
      );
    } else {
      // Something happened in setting up the request that triggered an Error
      return NextResponse.json(
        { message: error.message || 'Failed to test connection' },
        { status: 500 }
      );
    }
  }
} 