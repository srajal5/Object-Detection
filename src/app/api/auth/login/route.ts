import { NextRequest, NextResponse } from 'next/server';
import { loginUser, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Login user
    const { user, token } = await loginUser(email, password);

    // Create response
    const response = NextResponse.json(
      { message: 'Login successful', user },
      { status: 200 }
    );

    // Set auth cookie
    setAuthCookie(response, token);
    
    // Add debug headers to help diagnose issues
    response.headers.set('X-Auth-Token-Set', 'true');
    response.headers.set('X-Auth-User-ID', user._id || 'unknown');

    return response;
  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { message: error.message || 'Login failed' },
      { status: 401 }
    );
  }
} 