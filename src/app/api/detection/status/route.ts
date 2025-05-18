import { NextResponse } from 'next/server';
import axios from 'axios';

const DETECTION_API_URL = process.env.DETECTION_API_URL || 'http://localhost:5000';

export async function GET() {
  try {
    const response = await axios.get(`${DETECTION_API_URL}/status`);
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error checking detection status:', error);
    return NextResponse.json({ isRunning: false }, { status: 500 });
  }
} 