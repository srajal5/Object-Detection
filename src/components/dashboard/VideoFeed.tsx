"use client";

import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";

const DETECTION_API_URL = process.env.NEXT_PUBLIC_DETECTION_API_URL || 'http://localhost:5000';

export default function VideoFeed() {
  const videoRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Start the video feed
    if (videoRef.current) {
      videoRef.current.src = `${DETECTION_API_URL}/video_feed`;
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
      <img
        ref={videoRef}
        alt="Camera Feed"
        className="w-full h-full object-contain"
      />
    </Card>
  );
} 