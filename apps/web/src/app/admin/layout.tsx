"use client";

import { AdminNavbar } from "@/components/ui/admin-navbar";
import { Footer } from "@/components/ui/footer";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();

  useEffect(() => {
    if (authLoaded && !isSignedIn) {
      redirect("/sign-in");
    }
  }, [authLoaded, isSignedIn]);

  // Show loading while auth is being determined
  if (!authLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Only redirect if Clerk auth is not loaded or user is not signed in
  if (!isSignedIn) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen admin-gradient flex flex-col">
      <AdminNavbar />
      <main className="flex-1 bg-gray-50">{children}</main>
      <Footer />
    </div>
  );
}
