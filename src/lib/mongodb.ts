import mongoose from 'mongoose';

// Validate MongoDB URI format
const validateMongoURI = (uri: string) => {
  if (!uri) return false;
  if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) return true;
  return false;
};

// Get MongoDB URI from environment
if (!process.env.MONGODB_URI || !validateMongoURI(process.env.MONGODB_URI)) {
  throw new Error(
    'Invalid MONGODB_URI. Please define a valid MongoDB URI in your environment variables. ' +
    'It should start with mongodb:// or mongodb+srv://'
  );
}

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

let cached = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s
      socketTimeoutMS: 45000, // Close sockets after 45s
      family: 4, // Use IPv4
      maxPoolSize: 10, // Maximum number of connections in the pool
      minPoolSize: 1 // Minimum number of connections in the pool
    };

    console.log('Connecting to MongoDB...');
    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log('MongoDB connected successfully');
        return mongoose;
      })
      .catch((error) => {
        console.error('MongoDB connection error:', error);
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('Failed to connect to MongoDB:', e);
    throw e;
  }

  return cached.conn;
} 