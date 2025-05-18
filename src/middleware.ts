import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;
  
  console.log(`Middleware processing path: ${path}`);

  // Allow access to login and register pages
  if (path.startsWith("/auth/")) {
    return NextResponse.next();
  }

  // Check for token in cookies
  const token = request.cookies.get("token")?.value;
  console.log(`Token present: ${!!token}`);

  if (!token) {
    // Redirect to login if no token is present
    console.log('No token found, redirecting to login');
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  try {
    // Verify the token
    const secret = new TextEncoder().encode(JWT_SECRET);
    await jwtVerify(token, secret);
    
    // If token is valid and user is trying to access auth pages, redirect to dashboard
    if (path.startsWith("/auth/")) {
      console.log(`Authenticated user accessing auth path, redirecting to dashboard`);
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  } catch (error) {
    // If token is invalid, clear it and redirect to login
    console.log('Token verification failed:', error);
    const response = NextResponse.redirect(new URL("/auth/login", request.url));
    response.cookies.delete("token");
    return response;
  }
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/auth/:path*',
    '/login',
  ],
}; 