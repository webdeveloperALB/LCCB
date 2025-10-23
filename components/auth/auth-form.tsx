import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, AlertCircle, Mail, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// Extend Window interface to include presenceCleanup
declare global {
  interface Window {
    presenceCleanup?: () => void;
  }
}

export default function AuthForm() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    firstName: "",
    lastName: "",
    age: "",
  });

  // Reset showPassword when switching between sign in/up modes
  useEffect(() => {
    setShowPassword(false);
    setError(null);
    setSuccess(null);
  }, [isSignUp]);

  // Function to update user online status
  const updateUserOnlineStatus = async (userId: string, isOnline: boolean) => {
    try {
      const { data: existingRecord, error: selectError } = await supabase
        .from("user_presence")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (selectError && selectError.code !== "PGRST116") {
        console.error("Error checking user presence:", selectError);
        return;
      }

      const presenceData = {
        is_online: isOnline,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existingRecord) {
        const { error: updateError } = await supabase
          .from("user_presence")
          .update(presenceData)
          .eq("user_id", userId);

        if (updateError) {
          console.error("Error updating user presence:", updateError);
        } else {
          console.log(
            `User ${userId} status updated to ${
              isOnline ? "online" : "offline"
            }`
          );
        }
      } else {
        const { error: insertError } = await supabase
          .from("user_presence")
          .insert({
            user_id: userId,
            ...presenceData,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error("Error inserting user presence:", insertError);
        } else {
          console.log(
            `User ${userId} presence record created as ${
              isOnline ? "online" : "offline"
            }`
          );
        }
      }
    } catch (error) {
      console.error("Error in updateUserOnlineStatus:", error);
    }
  };

  // Function to set up presence tracking when user signs in
  const setupPresenceTracking = (userId: string) => {
    if (window.presenceCleanup) {
      window.presenceCleanup();
    }

    updateUserOnlineStatus(userId, true);

    const heartbeatInterval = setInterval(() => {
      updateUserOnlineStatus(userId, true);
    }, 30000);

    const handleBeforeUnload = () => {
      updateUserOnlineStatus(userId, false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateUserOnlineStatus(userId, false);
      } else {
        updateUserOnlineStatus(userId, true);
      }
    };

    const handleFocus = () => updateUserOnlineStatus(userId, true);
    const handleBlur = () => updateUserOnlineStatus(userId, false);

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    window.presenceCleanup = () => {
      console.log("Cleaning up presence tracking for user:", userId);
      clearInterval(heartbeatInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      updateUserOnlineStatus(userId, false);
      window.presenceCleanup = undefined;
    };

    console.log("Presence tracking set up for user:", userId);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        forgotPasswordEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) {
        throw error;
      }

      setSuccess(
        "Password reset email sent! Check your inbox for instructions."
      );
      setShowForgotPassword(false);
      setForgotPasswordEmail("");
    } catch (error: any) {
      setError(`Failed to send reset email: ${error.message}`);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log("Starting signup process...");

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name:
              formData.fullName || `${formData.firstName} ${formData.lastName}`,
            first_name: formData.firstName,
            last_name: formData.lastName,
            age: formData.age,
          },
        },
      });

      if (authError) {
        console.error("Auth signup error:", authError);
        throw authError;
      }

      console.log("Auth user created:", authData.user?.id);

      if (authData.user) {
        console.log("Inserting user into users table...");

        const { error: dbError } = await supabase.from("users").insert({
          id: authData.user.id,
          email: formData.email,
          password: formData.password,
          first_name: formData.firstName,
          last_name: formData.lastName,
          full_name:
            formData.fullName || `${formData.firstName} ${formData.lastName}`,
          age: parseInt(formData.age),
          kyc_status: "not_started",
          created_at: new Date().toISOString(),
        });

        if (dbError) {
          console.error("Database insert error:", dbError);
          console.log(
            "User will be prompted for KYC since they're not in users table"
          );
        } else {
          console.log("User successfully inserted into users table");
        }

        setupPresenceTracking(authData.user.id);
      }

      console.log("Signup response:", authData);
      setSuccess("Account created successfully! You can now sign in.");
    } catch (error: any) {
      console.error("Signup error details:", error);
      setError(`Signup failed: ${error.message || "Unknown error occurred"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log("Starting signin process...");

      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        console.error("Signin error:", error);
        throw error;
      }

      console.log("Signin successful:", data.user?.id);

      if (data.user) {
        setupPresenceTracking(data.user.id);
      }

      setSuccess("Successfully signed in!");
    } catch (error: any) {
      console.error("Signin error details:", error);
      setError(`Sign in failed: ${error.message || "Unknown error occurred"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="h-screen bg-[#0A7F8D] flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-auto sm:h-[600px] flex flex-col lg:flex-row overflow-visible">
          {/* Left side with ATM image - Hidden on mobile, visible on desktop */}
          <div className="relative w-full lg:w-2/5 h-32 sm:h-48 lg:h-full overflow-visible rounded-t-2xl lg:rounded-l-2xl lg:rounded-tr-none hidden sm:block">
            <div
              className="absolute inset-y-0 right-0 w-4 pointer-events-none hidden lg:block"
              style={{
                background:
                  "linear-gradient(to left, rgba(0,0,0,0.3), transparent)",
              }}
            />
            <div className="h-full flex items-center justify-center p-2 sm:p-4 pb-0 overflow-visible">
              <div className="transform overflow-visible">
                <img
                  src="/logo.png"
                  alt="Lithuanian Crypto Central Bank Logo"
                  className="h-[60px] sm:h-[160px] w-auto object-contain scale-110 sm:scale-125 lg:scale-150"
                />
              </div>
            </div>
          </div>
          {/* Right side with form */}
          <div className="w-full lg:w-3/5 flex flex-col rounded-2xl lg:rounded-r-2xl lg:rounded-l-none overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 bg-white gap-4 sm:gap-0">
              <div className="flex items-center">
               {/*<div className="flex items-center space-x-2">
                  <img
                    src="/logo.png"
                    alt="Logo"
                    className="w-36 h-36 object-contain"
                  />
                </div>*/}
              </div>
              <Button
                variant="outline"
                className="bg-transparent border-[#0A7F8D] text-[#0A7F8D] hover:bg-[#0A7F8D] hover:text-white px-4 py-2 text-sm rounded-md transition-all duration-300 w-full sm:w-auto"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? "Sign In" : "Create Account"}
              </Button>
            </div>
            {/* Form Container */}
            <div className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="mb-4 border-green-200 bg-green-50">
                  <AlertCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 text-sm">
                    {success}
                  </AlertDescription>
                </Alert>
              )}
              {!isSignUp ? (
                // Sign In Form
                <div className="max-w-sm mx-auto w-full">
                  <div className="mb-6 sm:mb-8">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                      Sign In
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Enter your Lithuanian Crypto Central Bank Account details.
                    </p>
                  </div>
                  <form onSubmit={handleSignIn} className="space-y-6">
                    <div>
                      <input
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                        className="w-full h-10 border-0 border-b-2 border-gray-300 rounded-none px-0 bg-transparent text-base outline-none focus:outline-none focus:ring-0 focus:shadow-none focus:border-[#0A7F8D]"
                      />
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        required
                        className="w-full h-10 border-0 border-b-2 border-gray-300 rounded-none px-0 pr-10 bg-transparent text-base outline-none focus:outline-none focus:ring-0 focus:shadow-none focus:border-[#0A7F8D]"
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
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remember"
                        className="w-4 h-4 border-2 border-gray-300 data-[state=checked]:bg-[#0A7F8D] data-[state=checked]:border-[#0A7F8D]"
                      />
                      <Label
                        htmlFor="remember"
                        className="text-sm text-gray-600 cursor-pointer"
                      >
                        Remember Me
                      </Label>
                    </div>
                    <Button
                      type="submit"
                      className="w-24 h-10 bg-[#0A7F8D] hover:bg-[#0A7F8D] text-white font-medium rounded-md transition-all duration-300 disabled:opacity-50"
                      disabled={loading}
                    >
                      {loading ? "..." : "Sign In"}
                    </Button>
                  </form>
                  {/*<div className="flex flex-col sm:flex-row justify-between items-center mt-6 sm:mt-8 text-xs gap-2 sm:gap-0">
                    <button
                      className="text-gray-500 hover:text-[#0A7F8D] transition-colors"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot Password?
                    </button>
                    <span className="text-gray-400 text-center sm:text-right">
                      For Banking of the Future, Based in Panama
                    </span>
                  </div>*/}
                </div>
              ) : (
                // Sign Up Form
                <div className="max-w-md mx-auto w-full">
                  <div className="mb-6 sm:mb-8">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                      Create your Lithuanian Crypto Central Bank Account
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Apply now and you will get access to your account within
                      the next few days.
                    </p>
                  </div>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <input
                          type="text"
                          placeholder="First Name"
                          value={formData.firstName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              firstName: e.target.value,
                            })
                          }
                          required
                          className="w-full h-10 border-0 border-b-2 border-gray-300 rounded-none px-0 bg-transparent text-base outline-none focus:outline-none focus:ring-0 focus:shadow-none focus:border-[#0A7F8D]"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Last Name"
                          value={formData.lastName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              lastName: e.target.value,
                            })
                          }
                          required
                          className="w-full h-10 border-0 border-b-2 border-gray-300 rounded-none px-0 bg-transparent text-base outline-none focus:outline-none focus:ring-0 focus:shadow-none focus:border-[#0A7F8D]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <input
                          type="email"
                          placeholder="Email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          required
                          className="w-full h-10 border-0 border-b-2 border-gray-300 rounded-none px-0 bg-transparent text-base outline-none focus:outline-none focus:ring-0 focus:shadow-none focus:border-[#0A7F8D]"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          placeholder="Age"
                          value={formData.age}
                          onChange={(e) =>
                            setFormData({ ...formData, age: e.target.value })
                          }
                          required
                          className="w-full h-10 border-0 border-b-2 border-gray-300 rounded-none px-0 bg-transparent text-base outline-none focus:outline-none focus:ring-0 focus:shadow-none focus:border-[#0A7F8D]"
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        required
                        className="w-full h-10 border-0 border-b-2 border-gray-300 rounded-none px-0 pr-12 bg-transparent text-base outline-none focus:outline-none focus:ring-0 focus:shadow-none focus:border-[#0A7F8D]"
                      />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0"
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
                    <div className="pt-6">
                      <Button
                        type="submit"
                        className="w-full h-12 bg-[#0A7F8D] hover:bg-[#0A7F8D] text-white font-medium rounded-md transition-all duration-300 disabled:opacity-50"
                        disabled={loading}
                      >
                        {loading ? "Creating Account..." : "Create Account"}
                      </Button>
                    </div>
                  </form>
                  <div className="flex flex-col sm:flex-row justify-between items-center mt-6 sm:mt-8 text-xs gap-2 sm:gap-0">
                    <button className="text-gray-500 hover:text-[#0A7F8D] transition-colors">
                      Return Home
                    </button>
                    <span className="text-gray-400 text-center sm:text-right">
                      The Banking of the Future, Based in Panama
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-[#0A7F8D]" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your
              password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email Address</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="Enter your email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                required
                className="focus:ring-[#0A7F8D] focus:border-[#0A7F8D]"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForgotPassword(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={forgotPasswordLoading}
                className="flex-1 bg-[#0A7F8D] hover:bg-[#E55A1F]"
              >
                {forgotPasswordLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
