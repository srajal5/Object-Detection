import Profile from '@/models/Profile';
import { connectDB } from './mongodb';

export async function createProfile(userId: string, email: string) {
  await connectDB();
  try {
    // Upsert profile (create if not exists, update if exists)
    const profile = await Profile.findOneAndUpdate(
      { userId },
      { userId, email },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return profile;
  } catch (error) {
    console.error('Error creating profile:', error);
    throw error;
  }
}

export async function getProfile(userId: string) {
  await connectDB();
  try {
    const profile = await Profile.findOne({ userId });
    if (!profile) throw new Error('Profile not found');
    return profile;
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
} 