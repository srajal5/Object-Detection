import { connectDB } from './mongodb';
import User from '@/models/User';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

export async function registerUser(email: string, password: string, name?: string) {
  try {
    await connectDB();
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    // Generate a unique user_id
    const user_id = crypto.randomUUID();
    
    // Create new user
    const user = new User({
      email,
      password,
      name,
      user_id,
    });
    
    await user.save();
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user.toObject();
    return userWithoutPassword;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

export async function loginUser(email: string, password: string) {
  try {
    await connectDB();
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }
    
    // Create JWT token using jose
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT({ userId: user._id })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(JWT_EXPIRES_IN)
      .sign(secret);
    
    // Return user without password and token
    const { password: _, ...userWithoutPassword } = user.toObject();
    return { user: userWithoutPassword, token };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function getCurrentUser(req: NextRequest) {
  try {
    // Get token from cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return null;
    }
    
    // Verify token using jose
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    // Only connect to DB if we need to fetch user data
    if (payload && payload.userId) {
      await connectDB();
      const user = await User.findById(payload.userId).select('-password');
      return user;
    }
    
    return null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
  
  // Add a debug log to verify the cookie is being set
  console.log('Setting auth cookie with token:', token.substring(0, 10) + '...');
  
  return res;
} 