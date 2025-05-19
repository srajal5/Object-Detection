import { NextResponse } from 'next/server';
import axios from 'axios';

const DETECTION_API_URL = process.env.DETECTION_API_URL || 'https://object-detection-backend.vercel.app';

interface DetectionRequestBody {
  cameraSource: string;
  ipCameraUrl?: string;
  ipCameraPort?: string;
  ntfyTopic?: string;
  ntfyPriority?: string;
  enableLogging?: boolean;
  enablePersonDetection?: boolean;
  streamQuality?: number;
  frameBufferSize?: number;
}

interface DetectionServiceBody {
  ntfyTopic: string;
  ntfyPriority: string;
  enableLogging: boolean;
  enablePersonDetection: boolean;
  streamQuality: number;
  frameBufferSize: number;
  ipCameraUrl?: string;
  ipCameraPort?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as DetectionRequestBody;
    console.log('Received request body:', body);
    
    // Validate required fields
    if (!body.cameraSource) {
      return NextResponse.json(
        { message: 'Camera source is required' },
        { status: 400 }
      );
    }

    // Prepare the request body for the detection service
    const detectionServiceBody: DetectionServiceBody = {
      ntfyTopic: body.ntfyTopic || '',
      ntfyPriority: body.ntfyPriority || 'default',
      enableLogging: body.enableLogging || false,
      enablePersonDetection: body.enablePersonDetection !== false,
      streamQuality: body.streamQuality || 80,
      frameBufferSize: body.frameBufferSize || 10
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
        detectionServiceBody.ipCameraUrl = body.ipCameraUrl;
        detectionServiceBody.ipCameraPort = body.ipCameraPort;
        break;

      case 'default':
        // For system default camera
        detectionServiceBody.ipCameraUrl = 'webcam://0';
        detectionServiceBody.ipCameraPort = '0';
        break;

      case 'cameo':
        // For Cameo Studio
        detectionServiceBody.ipCameraUrl = 'webcam://1';
        detectionServiceBody.ipCameraPort = '0';
        break;

      default:
        // For physical cameras
        if (body.cameraSource.startsWith('camera-') || body.cameraSource.includes('videoinput')) {
          detectionServiceBody.ipCameraUrl = `webcam://${body.cameraSource}`;
          detectionServiceBody.ipCameraPort = '0';
        } else {
          return NextResponse.json(
            { message: 'Invalid camera source' },
            { status: 400 }
          );
        }
    }

    console.log('Sending to detection service:', detectionServiceBody);

    // Forward the request to the detection service
    const response = await axios.post(`${DETECTION_API_URL}/start`, detectionServiceBody);
    console.log('Detection service response:', response.data);
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error starting detection:', error);
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Detection service error response:', error.response.data);
      return NextResponse.json(
        { message: error.response.data?.message || 'Failed to start detection' },
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
        { message: error.message || 'Failed to start detection' },
        { status: 500 }
      );
    }
  }
} 