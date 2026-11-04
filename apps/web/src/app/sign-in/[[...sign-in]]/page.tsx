"use client";

import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleIcon } from "@/components/ui/google-icon";
import { useAuth, useSignIn } from "@clerk/nextjs";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Redirect if user is already signed in (only once)
  useEffect(() => {
    if (authLoaded && isSignedIn) {
      // Use setTimeout to avoid race conditions with Next.js router
      const timer = setTimeout(() => {
        try {
          router.replace("/myAccount");
        } catch (error) {
          console.warn("Router navigation failed:", error);
          // Fallback to window.location if router fails
          window.location.href = "/myAccount";
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [authLoaded, isSignedIn, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    // Check if user is already signed in
    if (isSignedIn) {
      router.push("/myAccount");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await signIn.create({
        identifier: emailAddress,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        try {
          router.push("/myAccount");
        } catch (error) {
          console.warn("Router navigation failed:", error);
          window.location.href = "/myAccount";
        }
      } else {
        setError("Sign in failed. Please check your credentials.");
      }
    } catch (err: unknown) {
      const errorMessage =
        isClerkAPIResponseError(err)
          ? err.errors[0]?.message || "An error occurred during sign in"
          : "An error occurred during sign in";

      // Handle session already exists error
      if (
        errorMessage.includes("session already exists") ||
        errorMessage.includes("already signed in")
      ) {
        try {
          router.push("/myAccount");
        } catch (error) {
          console.warn("Router navigation failed:", error);
          window.location.href = "/myAccount";
        }
        return;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking for existing session
  if (!isLoaded || !authLoaded) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is already signed in, show a brief message before redirect
  if (isSignedIn) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      <div className="w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back
          </h2>
          <p className="text-gray-600">
            Sign in to your Gearboxe Market account
          </p>
        </div>

        <Card className="p-8 shadow-lg bg-white border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-gray-700"
              >
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="email"
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="pl-10 border-gray-300 focus:border-primary focus:ring-primary bg-white text-gray-900 placeholder:text-gray-500"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-gray-700"
              >
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 border-gray-300 focus:border-primary focus:ring-primary bg-white text-gray-900 placeholder:text-gray-500"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-gray-700"
                >
                  Remember me
                </label>
              </div>
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:text-primary/80"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white py-3 text-base font-medium"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-6 w-full border-gray-200 hover:bg-gray-50"
              disabled={isLoading}
              onClick={() => {
                setIsLoading(true);
                setError("");
                void signIn?.authenticateWithRedirect({
                  strategy: "oauth_google",
                  redirectUrl: "/sso-callback",
                  redirectUrlComplete: "/myAccount",
                }).catch((err: unknown) => {
                  setError(isClerkAPIResponseError(err) ? err.errors[0]?.message || "Google sign-in could not start" : "Google sign-in could not start");
                  setIsLoading(false);
                });
              }}
            >
              <GoogleIcon className="mr-2 h-5 w-5" />
              Continue with Google
            </Button>
          </div>
        </Card>

        <div className="text-center">
          <p className="text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="font-medium text-primary hover:text-primary/80"
            >
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
