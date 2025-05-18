import DetectionSettings from "@/components/dashboard/DetectionSettings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import VideoFeed from "@/components/dashboard/VideoFeed";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Detection Settings Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Configure your object detection system settings and notifications
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Live Feed</CardTitle>
            <CardDescription>
              Real-time camera feed with object detection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VideoFeed />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detection Configuration</CardTitle>
            <CardDescription>
              Configure your IP camera settings, NTFY notifications, and manage
              detection sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DetectionSettings />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
