import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Object Detection Dashboard</CardTitle>
          <CardDescription>
            Login or register to access your object detection system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure your IP camera, NTFY notifications, and manage your object
            detection sessions.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button asChild className="w-full">
            <Link href="/auth/login">Login</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/auth/register">Register</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
