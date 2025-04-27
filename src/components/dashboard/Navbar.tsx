"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function Navbar() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(error.message || "Failed to sign out");
        return;
      }
      toast.success("Signed out successfully");
      router.push("/");
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
    }
  };

  return (
    <nav className="bg-white dark:bg-slate-900 border-b dark:border-slate-800">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-lg font-bold">
            Object Detection Dashboard
          </Link>
          <div className="hidden md:flex space-x-4">
            <Link
              href="/dashboard"
              className="text-sm hover:text-blue-600 transition-colors"
            >
              Home
            </Link>
            <Link
              href="/dashboard/history"
              className="text-sm hover:text-blue-600 transition-colors"
            >
              Detection History
            </Link>
            <Link
              href="/dashboard/profile"
              className="text-sm hover:text-blue-600 transition-colors"
            >
              Profile
            </Link>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>
    </nav>
  );
}
