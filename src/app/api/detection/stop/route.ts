import { NextResponse } from 'next/server';
import axios from 'axios';

const DETECTION_API_URL = process.env.DETECTION_API_URL || 'http://localhost:5000';

export async function POST() {
  try {
    const response = await axios.post(`${DETECTION_API_URL}/stop`);
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error stopping detection:', error);
    return NextResponse.json(
      { message: error.response?.data?.message || 'Failed to stop detection' },
      { status: error.response?.status || 500 }
    );
  }
} 