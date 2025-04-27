import { Metadata } from "next";
import Navbar from "@/components/dashboard/Navbar";

export const metadata: Metadata = {
  title: "Dashboard | Object Detection System",
  description: "Configure and monitor your object detection system",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <Navbar />
      <div className="container mx-auto py-6 px-4">{children}</div>
    </div>
  );
}
