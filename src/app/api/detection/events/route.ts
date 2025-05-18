import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';
import DetectionEvent from '@/models/DetectionEvent';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const events = await DetectionEvent.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(100);

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching detection events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    await connectDB();

    const event = new DetectionEvent({
      userId: user._id,
      objectType: data.objectType,
      confidence: data.confidence,
      imageUrl: data.imageUrl,
    });

    await event.save();
    return NextResponse.json(event);
  } catch (error) {
    console.error('Error creating detection event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
} 