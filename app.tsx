"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/components/auth/auth-form";
import Dashboard from "@/components/dashboard/dashboard";
import type { User } from "@supabase/supabase-js";

// Unified Loading Component
const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-gradient-to-br from-orange-50 to-orange-100">
    <div className="relative">
      <img
        src="/logo.svg"
        alt="Loading logo"
        className="w-24 h-24 object-contain"
        onError={(e) => {
          // Fallback if logo doesn't exist
          e.currentTarget.style.display = "none";
        }}
      />
      <div className="absolute inset-0 animate-ping bg-orange-200 rounded-full opacity-20"></div>
    </div>
    <div className="space-y-2 text-center">
      <p className="text-gray-600 text-lg">Loading your dashboard...</p>
      <div className="flex justify-center space-x-1">
        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
        <div
          className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"
          style={{ animationDelay: "0.1s" }}
        ></div>
        <div
          className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"
          style={{ animationDelay: "0.2s" }}
        ></div>
      </div>
    </div>
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialAuthComplete, setInitialAuthComplete] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      setInitialAuthComplete(true);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // Don't show loading for subsequent auth changes
      if (initialAuthComplete) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [initialAuthComplete]);

  // Show loading screen only during initial auth check
  if (loading || !initialAuthComplete) {
    return <LoadingScreen />;
  }

  return user ? <Dashboard /> : <AuthForm />;
}
