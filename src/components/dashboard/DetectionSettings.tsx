"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";

interface DetectionSettingsFormData {
  ipCameraUrl: string;
  ipCameraPort: string;
  ntfyTopic: string;
  ntfyPriority: string;
  enableLogging: boolean;
  enablePersonDetection: boolean;
}

export default function DetectionSettings() {
  const [isSessionRunning, setIsSessionRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  const form = useForm<DetectionSettingsFormData>({
    defaultValues: {
      ipCameraUrl: "",
      ipCameraPort: "8080",
      ntfyTopic: "",
      ntfyPriority: "default",
      enableLogging: false,
      enablePersonDetection: true,
    },
  });

  // Get API URL from environment or use default
  const apiUrl =
    process.env.NEXT_PUBLIC_DETECTION_API_URL || "http://localhost:5000";

  // Add a function to check detector health more thoroughly
  const checkDetectorHealth = async () => {
    try {
      const response = await axios.get(`${apiUrl}/health`);
      const { detection_active, monitoring_active, heartbeat_age } =
        response.data;

      // Update UI state
      setIsSessionRunning(detection_active);

      // If monitoring is active but detection isn't, there might be an issue
      if (monitoring_active && !detection_active) {
        // If we previously thought detection was running, notify the user
        if (isSessionRunning) {
          toast.error(
            "Detection stopped unexpectedly. The system is attempting to restart it."
          );
        }
      }

      // Log monitoring info but don't show to user
      if (detection_active && heartbeat_age !== null) {
        console.debug(`Detector heartbeat age: ${heartbeat_age.toFixed(1)}s`);
      }

      return detection_active;
    } catch (error) {
      console.error("Failed to check detector health", error);
      return false;
    }
  };

  // Use this enhanced health check in useEffect
  useEffect(() => {
    const checkStatus = async () => {
      try {
        await checkDetectorHealth();
      } catch (error) {
        console.error("Failed to check detection status", error);
        // If server is not running, we assume detection is not active
        setIsSessionRunning(false);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    // Load saved settings
    const loadSettings = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data, error } = await supabase
            .from("detection_settings")
            .select("*")
            .eq("user_id", user.id)
            .single();

          if (data && !error) {
            form.setValue("ipCameraUrl", data.ip_camera_url || "");
            form.setValue("ipCameraPort", data.ip_camera_port || "8080");
            form.setValue("ntfyTopic", data.ntfy_topic || "");
            form.setValue("ntfyPriority", data.ntfy_priority || "default");
            form.setValue("enableLogging", data.enable_logging || false);
            form.setValue(
              "enablePersonDetection",
              data.enable_person_detection !== false
            ); // Default to true if not set
          }
        }
      } catch (error) {
        console.error("Failed to load settings", error);
      }
    };

    checkStatus();
    loadSettings();

    // Poll for status updates with variable interval
    const checkInterval = 5000; // 5 seconds
    const intervalId = setInterval(checkStatus, checkInterval);

    return () => clearInterval(intervalId);
  }, [apiUrl, form]);

  const startSession = async () => {
    setIsLoading(true);
    try {
      // Get form values for sending to the API
      const formValues = form.getValues();

      // Validate required fields before sending
      if (!formValues.ipCameraUrl) {
        toast.error("Camera URL is required");
        setIsLoading(false);
        return;
      }

      toast.info("Starting detection session...");

      // Send request to start detection
      const response = await axios.post(
        `${apiUrl}/start`,
        { ...formValues },
        { timeout: 15000 } // Increase timeout to 15 seconds
      );

      if (response.status === 200) {
        setIsSessionRunning(true);
        toast.success("Object detection session started successfully!");

        // Start polling for status more frequently at first to detect early failures
        const initialPollCount = 5;
        let pollCount = 0;

        const quickPoll = setInterval(async () => {
          try {
            const statusResponse = await axios.get(`${apiUrl}/status`);
            const isActive = statusResponse.data.detection_active;
            setIsSessionRunning(isActive);

            if (!isActive && pollCount > 0) {
              // Session stopped unexpectedly
              toast.error("Detection session stopped unexpectedly");
              clearInterval(quickPoll);
            }

            pollCount++;
            if (pollCount >= initialPollCount) {
              clearInterval(quickPoll);
            }
          } catch (error) {
            console.error("Error checking status", error);
            clearInterval(quickPoll);
          }
        }, 1000); // Check every second for the first few seconds
      } else {
        toast.error(
          response.data.message || "Failed to start detection session"
        );
      }
    } catch (error: any) {
      console.error("Start session error:", error);

      // More detailed error message
      const errorMessage =
        error.response?.data?.message ||
        (error.code === "ECONNABORTED"
          ? "Connection timeout. Server may be busy or unreachable."
          : "Failed to start detection session");

      toast.error(errorMessage);

      // Make sure UI reflects that the session is not running
      setIsSessionRunning(false);
    } finally {
      setIsLoading(false);
    }
  };

  const stopSession = async () => {
    setIsLoading(true);
    try {
      // Send request to stop detection
      const response = await axios.post(`${apiUrl}/stop`);

      if (response.status === 200) {
        setIsSessionRunning(false);
        toast.success("Object detection session stopped");
      } else {
        toast.error(
          response.data.message || "Failed to stop detection session"
        );
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to stop detection session"
      );
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: DetectionSettingsFormData) => {
    setIsLoading(true);
    try {
      // Save the configuration to Supabase
      const { error } = await supabase.from("detection_settings").upsert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        ip_camera_url: data.ipCameraUrl,
        ip_camera_port: data.ipCameraPort,
        ntfy_topic: data.ntfyTopic,
        ntfy_priority: data.ntfyPriority,
        enable_logging: data.enableLogging,
        enable_person_detection: data.enablePersonDetection,
      });

      if (error) {
        toast.error(error.message || "Failed to save settings");
        return;
      }

      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const ipCameraUrl = form.getValues().ipCameraUrl;
      const ipCameraPort = form.getValues().ipCameraPort;

      toast.info(`Testing connection to ${ipCameraUrl}:${ipCameraPort}...`);

      // Call the test-camera endpoint
      const response = await axios.post(
        `${apiUrl}/test-camera`,
        {
          url: ipCameraUrl,
          port: ipCameraPort,
        },
        { timeout: 10000 }
      );

      if (response.data.success) {
        toast.success("Connection successful!");
      } else {
        toast.error(response.data.message || "Connection failed");
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Could not connect to the IP camera"
      );
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingStatus) {
    return <div className="text-center py-8">Checking detection status...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Session Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <div
                className={`h-3 w-3 rounded-full ${
                  isSessionRunning ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span>{isSessionRunning ? "Running" : "Stopped"}</span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={startSession}
                disabled={isSessionRunning || isLoading}
                className="flex-1"
              >
                Start Session
              </Button>
              <Button
                onClick={stopSession}
                disabled={!isSessionRunning || isLoading}
                variant="destructive"
                className="flex-1"
              >
                Stop Session
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Camera Preview */}
      {isSessionRunning && (
        <Card className="mb-6 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>Camera Feed</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex justify-center">
            <div className="relative w-full aspect-video max-h-[400px] bg-black flex justify-center">
              <img
                src={`${apiUrl}/video_feed?t=${Date.now()}`}
                alt="Camera Feed"
                className="h-full object-contain"
                style={{
                  maxHeight: "400px",
                  imageRendering: "optimizeSpeed",
                }}
                loading="eager"
              />
              <div className="absolute bottom-2 right-2 text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">
                Live Detection
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* IP Camera Configuration */}
          <div className="p-4 border rounded-lg bg-gray-50 dark:bg-slate-900">
            <h3 className="text-lg font-medium mb-4">
              Camera Stream Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ipCameraUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Camera URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="http://192.168.1.100 or rtmp://stream"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter URL (HTTP, RTMP, SRT) of your camera stream
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ipCameraPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Port (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="8080" {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter port if not included in the URL
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="my-4 text-sm text-gray-500 dark:text-gray-400">
              <p>Supported formats:</p>
              <ul className="list-disc list-inside ml-2 mt-1">
                <li>
                  HTTP:{" "}
                  <span className="font-mono">http://192.168.1.100:8080</span>
                </li>
                <li>
                  RTMP:{" "}
                  <span className="font-mono">rtmp://server/live/stream</span>
                </li>
                <li>
                  SRT: <span className="font-mono">srt://server:1234</span>
                </li>
                <li>
                  Local webcam: <span className="font-mono">webcam://0</span>{" "}
                  (use index for multiple cameras)
                </li>
              </ul>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                disabled={isLoading}
              >
                Test Connection
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  form.setValue("ipCameraUrl", "webcam://0");
                  form.setValue("ipCameraPort", "");
                  toast.info(
                    "Local webcam selected. Click 'Test Connection' to verify."
                  );
                }}
                disabled={isLoading}
              >
                Use Local Webcam
              </Button>
            </div>
          </div>

          {/* NTFY Configuration */}
          <div className="p-4 border rounded-lg bg-gray-50 dark:bg-slate-900">
            <h3 className="text-lg font-medium mb-4">
              NTFY Notification Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ntfyTopic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NTFY Topic</FormLabel>
                    <FormControl>
                      <Input placeholder="your-unique-topic" {...field} />
                    </FormControl>
                    <FormDescription>
                      Create a unique topic for your notifications
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ntfyPriority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NTFY Priority</FormLabel>
                    <FormControl>
                      <Input placeholder="default" {...field} />
                    </FormControl>
                    <FormDescription>
                      Set the priority for your notifications (default, high,
                      etc.)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-4">
              <FormField
                control={form.control}
                name="enablePersonDetection"
                render={({ field }) => (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enablePersonDetection"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label
                      htmlFor="enablePersonDetection"
                      className="font-medium text-gray-700 dark:text-gray-200"
                    >
                      Priority Person Detection Alerts
                    </label>
                  </div>
                )}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 ml-6">
                Send urgent notifications when people are detected (bypasses
                cooldown period)
              </p>
            </div>

            <div className="mt-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm">
              <p>
                NTFY is a simple notification service. You can subscribe to your
                topic by visiting:{" "}
                <span className="font-mono">https://ntfy.sh/your-topic</span>
              </p>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Configuration"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
