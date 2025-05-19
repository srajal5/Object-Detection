-- Create detection_events table
CREATE TABLE IF NOT EXISTS detection_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    person_count INTEGER NOT NULL,
    confidence FLOAT NOT NULL,
    object_type TEXT NOT NULL,
    image_url TEXT,
    metadata JSONB
);

-- Create index on user_id and created_at for faster queries
CREATE INDEX IF NOT EXISTS idx_detection_events_user_id ON detection_events(user_id);
CREATE INDEX IF NOT EXISTS idx_detection_events_created_at ON detection_events(created_at);

-- Add RLS policies
ALTER TABLE detection_events ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own detection events
CREATE POLICY "Users can view their own detection events"
    ON detection_events
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy for users to insert their own detection events
CREATE POLICY "Users can insert their own detection events"
    ON detection_events
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own detection events
CREATE POLICY "Users can update their own detection events"
    ON detection_events
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy for users to delete their own detection events
CREATE POLICY "Users can delete their own detection events"
    ON detection_events
    FOR DELETE
    USING (auth.uid() = user_id); 