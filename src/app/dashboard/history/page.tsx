import DetectionHistory from "@/components/dashboard/DetectionHistory";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Detection History</h1>
        <p className="text-gray-500 dark:text-gray-400">
          View a log of all detection events and notifications
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detection Events</CardTitle>
          <CardDescription>
            A chronological list of object detection events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DetectionHistory />
        </CardContent>
      </Card>
    </div>
  );
}
