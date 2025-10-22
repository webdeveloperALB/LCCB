"use client";
import { useState, useEffect } from "react";
import type React from "react";

import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, AlertCircle, CheckCircle, Lock } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if we have a valid session for password reset
    const checkSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (session && !error) {
        setValidSession(true);
      } else {
        // If no valid session, redirect to auth page
        router.push("/");
      }
    };

    checkSession();
  }, [router]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    // Validate password strength
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    try {
      // Update the user's password in Supabase Auth
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      // Get the current session to ensure we have the user ID
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        throw new Error("Unable to verify user session");
      }

      const userId = session.user.id;

      // Update password in users table (with proper RLS context)
      const { error: usersError } = await supabase
        .from("users")
        .update({
          password: password,
          created_at: new Date().toISOString(), // Update timestamp
        })
        .eq("id", userId);

      if (usersError) {
        console.error("Error updating users table:", usersError);
        // Don't throw here - the auth password was updated successfully
        console.log(
          "Auth password updated but users table update failed - this is okay"
        );
      } else {
        console.log("Users table updated successfully");
      }

      // Update password in profiles table (with proper RLS context)
      const { error: profilesError } = await supabase
        .from("profiles")
        .update({
          password: password,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (profilesError) {
        console.error("Error updating profiles table:", profilesError);
        // Don't throw here - the auth password was updated successfully
        console.log(
          "Auth password updated but profiles table update failed - this is okay"
        );
      } else {
        console.log("Profiles table updated successfully");
      }

      // After successful password reset, instead of just setting success and redirecting to "/"
      // We need to handle the authenticated state properly

      setSuccess(true);

      // Sign out and then redirect to login, or redirect to dashboard if user should stay logged in
      // Since user is now authenticated with new password, redirect to dashboard
      setTimeout(() => {
        // Instead of router.push("/"), redirect to dashboard or trigger auth state check
        window.location.href = "/"; // This will trigger the auth wrapper to check KYC status and redirect appropriately
      }, 2000); // Reduced timeout for better UX
    } catch (error: any) {
      console.error("Password reset error:", error);
      setError(`Failed to reset password: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!validSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto"></div>
          <p className="mt-2 text-gray-600">Validating reset link...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Password Reset Successful
            </CardTitle>
            <CardDescription>
              Your password has been successfully updated. Redirecting to your
              dashboard...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              onClick={() => router.push("/")}
              className="w-full bg-[#F26623] hover:bg-[#E55A1F]"
            ></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-[#F26623] bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-[#F26623]" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Set New Password
          </CardTitle>
          <CardDescription>
            Enter your new password below to complete the reset process.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10 focus:ring-[#F26623] focus:border-[#F26623]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pr-10 focus:ring-[#F26623] focus:border-[#F26623]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F26623] hover:bg-[#E55A1F]"
              >
                {loading ? "Updating Password..." : "Update Password"}
              </Button>
            </div>
          </form>

          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              onClick={() => router.push("/")}
              className="text-sm text-gray-500 hover:text-[#F26623]"
            >
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
