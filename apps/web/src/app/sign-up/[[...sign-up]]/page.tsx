"use client";

import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleIcon } from "@/components/ui/google-icon";
import { useAuth, useSignUp } from "@clerk/nextjs";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
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

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await signUp.create({
        emailAddress,
        password,
        firstName,
        lastName,
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: unknown) {
      const errorMessage =
        isClerkAPIResponseError(err)
          ? err.errors[0]?.message || "An error occurred during sign up"
          : "An error occurred during sign up";

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

  const onPressVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setIsLoading(true);
    setError("");

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        try {
          router.push("/myAccount");
        } catch (error) {
          console.warn("Router navigation failed:", error);
          window.location.href = "/myAccount";
        }
      } else {
        setError("Verification failed. Please check your code.");
      }
    } catch (err: unknown) {
      setError(
        isClerkAPIResponseError(err)
          ? err.errors[0]?.message || "An error occurred during verification"
          : "An error occurred during verification"
      );
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

  if (pendingVerification) {
    return (
      <div className="w-full space-y-8">
        <div className="w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Verify your email
            </h2>
            <p className="text-gray-600">
              We&apos;ve sent a verification code to your email address
            </p>
          </div>

          <Card className="p-8 shadow-lg bg-white border-gray-200">
            <form onSubmit={onPressVerify} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="code"
                  className="text-sm font-medium text-gray-700"
                >
                  Verification code
                </Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="border-gray-300 focus:border-primary focus:ring-primary text-center text-lg tracking-widest bg-white text-gray-900 placeholder:text-gray-500"
                  placeholder="Enter verification code"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white py-3 text-base font-medium"
                disabled={isLoading}
              >
                {isLoading ? "Verifying..." : "Verify email"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      <div className="w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Join Gearboxe Market
          </h2>
          <p className="text-gray-600">
            Create your account and start connecting with car enthusiasts
          </p>
        </div>

        <Card className="p-8 shadow-lg bg-white border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="firstName"
                  className="text-sm font-medium text-gray-700"
                >
                  First name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="pl-10 border-gray-300 focus:border-primary focus:ring-primary bg-white text-gray-900 placeholder:text-gray-500"
                    placeholder="First name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="lastName"
                  className="text-sm font-medium text-gray-700"
                >
                  Last name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="pl-10 border-gray-300 focus:border-primary focus:ring-primary bg-white text-gray-900 placeholder:text-gray-500"
                    placeholder="Last name"
                    required
                  />
                </div>
              </div>
            </div>

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
                  placeholder="Create a password"
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

            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="text-sm font-medium text-gray-700"
              >
                Confirm password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 border-gray-300 focus:border-primary focus:ring-primary bg-white text-gray-900 placeholder:text-gray-500"
                  placeholder="Confirm your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                required
              />
              <label
                htmlFor="terms"
                className="ml-2 block text-sm text-gray-700"
              >
                I agree to the{" "}
                <Link
                  href="/terms"
                  className="text-primary hover:text-primary/80"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="text-primary hover:text-primary/80"
                >
                  Privacy Policy
                </Link>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white py-3 text-base font-medium"
              disabled={isLoading}
            >
              {isLoading ? "Creating account..." : "Create account"}
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
                void signUp?.authenticateWithRedirect({
                  strategy: "oauth_google",
                  redirectUrl: "/sso-callback",
                  redirectUrlComplete: "/myAccount",
                }).catch((err: unknown) => {
                  setError(isClerkAPIResponseError(err) ? err.errors[0]?.message || "Google sign-up could not start" : "Google sign-up could not start");
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
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="font-medium text-primary hover:text-primary/80"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
