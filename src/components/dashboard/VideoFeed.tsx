"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

const DETECTION_API_URL = process.env.NEXT_PUBLIC_DETECTION_API_URL || 'http://localhost:5000';

export default function VideoFeed() {
  const videoRef = useRef<HTMLImageElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Start the video feed
    if (videoRef.current) {
      const videoUrl = `${DETECTION_API_URL}/video_feed`;
      console.log('Connecting to video feed:', videoUrl);
      
      videoRef.current.onerror = () => {
        console.error('Error loading video feed');
        setError('Failed to load video feed. Please check if the backend is running.');
      };

      videoRef.current.src = videoUrl;
    }

    // Cleanup function to stop the video feed
    return () => {
      if (videoRef.current) {
        videoRef.current.src = '';
      }
    };
  }, []);

  return (
    <Card className="relative aspect-video overflow-hidden">
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <p className="text-red-500">{error}</p>
        </div>
      ) : (
        <img
          ref={videoRef}
          alt="Camera Feed"
          className="w-full h-full object-contain"
        />
      )}
    </Card>
  );
} 