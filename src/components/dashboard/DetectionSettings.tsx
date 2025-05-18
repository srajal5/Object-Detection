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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import axios from "axios";

interface DetectionSettingsFormData {
  cameraSource: string;
  ipCameraUrl: string;
  ipCameraPort: string;
  ntfyTopic: string;
  ntfyPriority: string;
  enableLogging: boolean;
  enablePersonDetection: boolean;
  streamQuality: number;
  frameBufferSize: number;
}

export default function DetectionSettings() {
  const [isSessionRunning, setIsSessionRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);

  const form = useForm<DetectionSettingsFormData>({
    defaultValues: {
      cameraSource: "default",
      ipCameraUrl: "",
      ipCameraPort: "8080",
      ntfyTopic: "",
      ntfyPriority: "default",
      enableLogging: false,
      enablePersonDetection: true,
      streamQuality: 80,
      frameBufferSize: 10,
    },
  });

  useEffect(() => {
    // Get available cameras
    const getCameras = async () => {
      try {
        // Request camera permissions first
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras: MediaDeviceInfo[] = devices
          .filter(device => device.kind === 'videoinput' && device.deviceId)
          .map((camera, index) => ({
            ...camera,
            deviceId: camera.deviceId || `camera-${Math.random().toString(36).substr(2, 9)}`,
            label: camera.label || `Camera ${index + 1}`
          }));
        setAvailableCameras(cameras);
      } catch (error) {
        console.error("Failed to get cameras:", error);
        toast.error("Failed to access camera devices. Please ensure camera permissions are granted.");
      }
    };

    getCameras();
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/detection/status');
        const data = await response.json();
        setIsSessionRunning(data.isRunning);
      } catch (error) {
        console.error("Failed to check detection status", error);
        setIsSessionRunning(false);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    const loadSettings = async () => {
      try {
        const response = await fetch('/api/detection/settings');
        const data = await response.json();

        if (data.settings) {
          form.reset(data.settings);
        }
      } catch (error) {
        console.error("Failed to load settings", error);
        toast.error("Failed to load detection settings");
      }
    };

    checkStatus();
    loadSettings();
  }, [form]);

  const onSubmit = async (data: DetectionSettingsFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/detection/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Save settings error:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsLoading(false);
    }
  };

  const startSession = async () => {
    setIsLoading(true);
    try {
      const formValues = form.getValues();
      
      // Validate form values
      if (!formValues.cameraSource) {
        toast.error("Please select a camera source");
        setIsLoading(false);
        return;
      }

      // Prepare request body based on camera source
      const requestBody: any = {
        cameraSource: formValues.cameraSource,
        ntfyTopic: formValues.ntfyTopic,
        ntfyPriority: formValues.ntfyPriority,
        enableLogging: formValues.enableLogging,
        enablePersonDetection: formValues.enablePersonDetection,
        streamQuality: formValues.streamQuality,
        frameBufferSize: formValues.frameBufferSize,
      };

      // Handle different camera sources
      switch (formValues.cameraSource) {
        case 'ip':
          if (!formValues.ipCameraUrl?.trim()) {
            toast.error("IP Camera URL is required");
            setIsLoading(false);
            return;
          }
          if (!formValues.ipCameraPort?.trim()) {
            toast.error("IP Camera Port is required");
            setIsLoading(false);
            return;
          }
          requestBody.ipCameraUrl = formValues.ipCameraUrl;
          requestBody.ipCameraPort = formValues.ipCameraPort;
          break;

        case 'default':
          // For system default camera, use webcam://0
          requestBody.ipCameraUrl = 'webcam://0';
          requestBody.ipCameraPort = '0';
          break;

        case 'cameo':
          // For Cameo Studio, use webcam://1
          requestBody.ipCameraUrl = 'webcam://1';
          requestBody.ipCameraPort = '0';
          break;

        default:
          // For physical cameras, use the device ID
          if (formValues.cameraSource.startsWith('camera-') || formValues.cameraSource.includes('videoinput')) {
            requestBody.ipCameraUrl = `webcam://${formValues.cameraSource}`;
            requestBody.ipCameraPort = '0';
          }
      }

      const response = await fetch('/api/detection/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to start detection session');
      }

      setIsSessionRunning(true);
      toast.success("Detection session started");
    } catch (error: any) {
      console.error("Start session error:", error);
      toast.error(error.message || "Failed to start detection session");
    } finally {
      setIsLoading(false);
    }
  };

  const stopSession = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/detection/stop', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to stop detection session');
      }

      setIsSessionRunning(false);
      toast.success("Detection session stopped");
    } catch (error: any) {
      console.error("Stop session error:", error);
      toast.error(error.message || "Failed to stop detection session");
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      const formValues = form.getValues();
      
      // Validate camera source
      if (!formValues.cameraSource) {
        toast.error("Please select a camera source");
        return;
      }

      // Validate IP camera fields if IP camera is selected
      if (formValues.cameraSource === 'ip') {
        if (!formValues.ipCameraUrl?.trim()) {
          toast.error("IP Camera URL is required");
          return;
        }
        if (!formValues.ipCameraPort?.trim()) {
          toast.error("IP Camera Port is required");
          return;
        }
      }

      const response = await fetch('/api/detection/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cameraSource: formValues.cameraSource,
          ipCameraUrl: formValues.ipCameraUrl,
          ipCameraPort: formValues.ipCameraPort,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Connection test failed');
      }

      toast.success("Connection test successful!");
    } catch (error: any) {
      console.error("Test connection error:", error);
      toast.error(error.message || "Connection test failed");
    }
  };

  if (isCheckingStatus) {
    return <div className="text-center py-8">Checking detection status...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Camera Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Camera Settings</h3>
            <FormField
              control={form.control}
              name="cameraSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Camera Source</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select camera source" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="default">System Default Camera</SelectItem>
                      <SelectItem value="cameo">Cameo Studio</SelectItem>
                      <SelectItem value="ip">IP Camera</SelectItem>
                      {availableCameras.map((camera) => (
                        <SelectItem 
                          key={camera.deviceId} 
                          value={camera.deviceId}
                        >
                          {camera.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select your preferred camera source
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("cameraSource") === "ip" && (
              <>
                <FormField
                  control={form.control}
                  name="ipCameraUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Camera URL</FormLabel>
                      <FormControl>
                        <Input placeholder="http://192.168.1.100" {...field} />
                      </FormControl>
                      <FormDescription>
                        The URL of your IP camera stream
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
                      <FormLabel>Camera Port</FormLabel>
                      <FormControl>
                        <Input placeholder="8080" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={testConnection}
              disabled={isLoading}
            >
              Test Connection
            </Button>
          </div>

          {/* NTFY Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">NTFY Notifications</h3>
            <FormField
              control={form.control}
              name="ntfyTopic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NTFY Topic</FormLabel>
                  <FormControl>
                    <Input placeholder="your-topic" {...field} />
                  </FormControl>
                  <FormDescription>
                    Create a unique topic at ntfy.sh
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
                  <FormLabel>Notification Priority</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Advanced Settings</h3>
            <FormField
              control={form.control}
              name="enableLogging"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Enable Logging</FormLabel>
                    <FormDescription>
                      Log detection events to database
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enablePersonDetection"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Person Detection</FormLabel>
                    <FormDescription>
                      Enable person detection notifications
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="streamQuality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stream Quality</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    JPEG quality for camera streams (1-100)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="frameBufferSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frame Buffer Size</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Number of frames to buffer (1-30)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <Button
            type="button"
            onClick={startSession}
            disabled={isLoading || isSessionRunning}
          >
            Start Detection
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={stopSession}
            disabled={isLoading || !isSessionRunning}
          >
            Stop Detection
          </Button>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          Save Settings
        </Button>
      </form>
    </Form>
  );
}
