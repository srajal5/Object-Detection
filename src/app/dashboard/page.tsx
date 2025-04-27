import DetectionSettings from "@/components/dashboard/DetectionSettings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Detection Settings Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Configure your object detection system settings and notifications
        </p>
      </div>

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
  );
}
