"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/components/auth/auth-form";
import Dashboard from "@/components/dashboard/dashboard";
import KYCVerification from "@/components/auth/kyc-verification";
import type { User } from "@supabase/supabase-js";

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryAttempts, setRetryAttempts] = useState(0);

  // Refs for state management
  const hasInitialized = useRef(false);
  const isCheckingKYC = useRef(false);
  const forceRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const lastActiveTime = useRef(Date.now());
  const isTabVisible = useRef(true);

  // Page Visibility API to handle tab switching
  useEffect(() => {
    const handleVisibilityChange = () => {
      const wasVisible = isTabVisible.current;
      isTabVisible.current = !document.hidden;

      if (!wasVisible && isTabVisible.current) {
        // Tab became visible again
        lastActiveTime.current = Date.now();
        console.log("👁️ Tab became visible again");
      } else if (wasVisible && !isTabVisible.current) {
        // Tab became hidden
        console.log("🙈 Tab became hidden");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // FORCE FETCH function with tab visibility awareness
  const forceFetchUserData = useCallback(
    async (userId: string, retryCount = 0): Promise<void> => {
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 2000;

      if (!mountedRef.current || isCheckingKYC.current) return;

      // Don't fetch if tab is not visible unless it's the initial load
      if (!isTabVisible.current && hasInitialized.current) {
        console.log("🙈 Skipping fetch - tab not visible");
        return;
      }

      isCheckingKYC.current = true;

      try {
        console.log(
          `🚀 FORCE FETCHING user data (attempt ${retryCount + 1}/${
            MAX_RETRIES + 1
          })`
        );

        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("kyc_status")
          .eq("id", userId)
          .single();

        if (userError) {
          if (userError.code === "PGRST116") {
            console.log("✅ User not in users table, defaulting to approved");
            if (mountedRef.current) {
              setKycStatus("approved");
              setLoading(false);
              setError(null);
            }
            return;
          }
          throw userError;
        }

        const status = userData?.kyc_status || "approved";
        console.log("✅ KYC status fetched successfully:", status);

        if (mountedRef.current) {
          setKycStatus(status);
          setLoading(false);
          setError(null);
          setRetryAttempts(0);
        }
      } catch (error) {
        console.error(
          `❌ Force fetch failed (attempt ${retryCount + 1}):`,
          error
        );

        if (retryCount < MAX_RETRIES && mountedRef.current) {
          const delay = RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`🔄 Retrying in ${delay}ms...`);
          setTimeout(() => {
            if (mountedRef.current) {
              forceFetchUserData(userId, retryCount + 1);
            }
          }, delay);
        } else {
          console.log(
            "🛡️ Max retries reached, defaulting to approved to prevent infinite loading"
          );
          if (mountedRef.current) {
            setKycStatus("approved");
            setLoading(false);
            setError(null);
          }
        }
      } finally {
        isCheckingKYC.current = false;
      }
    },
    []
  );

  // FORCE SESSION CHECK with tab visibility awareness
  const forceValidateSession = useCallback(async (): Promise<User | null> => {
    try {
      console.log("🔍 FORCE validating session...");

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.user) {
        console.log("❌ No valid session found");
        return null;
      }

      // Only double-check if tab is visible or it's initial load
      if (isTabVisible.current || !hasInitialized.current) {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          console.log("❌ Session validation failed");
          return null;
        }

        console.log("✅ Session validated successfully:", authData.user.id);
        return authData.user;
      }

      // If tab is not visible, trust the session
      console.log("✅ Session trusted (tab not visible):", session.user.id);
      return session.user;
    } catch (error) {
      console.error("❌ Session validation error:", error);
      return null;
    }
  }, []);

  // Initialize authentication
  useEffect(() => {
    const initializeAuth = async () => {
      if (hasInitialized.current || !mountedRef.current) return;
      hasInitialized.current = true;

      console.log("🚀 FORCE initializing authentication...");
      setLoading(true);

      // Check for cache-busting parameter and remove it
      if (window.location.search.includes("_t=")) {
        const url = new URL(window.location.href);
        url.searchParams.delete("_t");
        window.history.replaceState({}, "", url.pathname + url.search);
      }

      const validatedUser = await forceValidateSession();
      if (!mountedRef.current) return;

      if (!validatedUser) {
        console.log("❌ No valid user, showing auth form");
        setUser(null);
        setKycStatus(null);
        setLoading(false);
        return;
      }

      console.log("✅ User authenticated, force fetching data...");
      setUser(validatedUser);
      await forceFetchUserData(validatedUser.id);
    };

    initializeAuth();
  }, [forceValidateSession, forceFetchUserData]);

  // Auth state listener with debouncing
  useEffect(() => {
    let debounceTimeout: NodeJS.Timeout;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current || event === "INITIAL_SESSION") return;

      // Clear any existing debounce
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Debounce auth state changes to prevent rapid firing
      debounceTimeout = setTimeout(async () => {
        console.log(
          "🔄 Auth state changed:",
          event,
          session?.user?.id || "No user"
        );

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setError(null);

        if (currentUser && event === "SIGNED_IN") {
          console.log("🚀 User signed in, FORCE fetching data...");
          setLoading(true);
          await forceFetchUserData(currentUser.id);
        } else if (!currentUser && event === "SIGNED_OUT") {
          console.log("👋 User signed out");
          setKycStatus(null);
          setLoading(false);
        }
      }, 500); // 500ms debounce
    });

    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      subscription.unsubscribe();
    };
  }, [forceFetchUserData]);

  // Session monitoring with tab visibility awareness
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!mountedRef.current || !user || loading) return;

      // Only monitor session if tab has been visible recently
      const timeSinceActive = Date.now() - lastActiveTime.current;
      if (!isTabVisible.current && timeSinceActive > 300000) {
        // 5 minutes
        console.log("⏰ Skipping session check - tab inactive too long");
        return;
      }

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session) {
          console.warn("⚠️ Session lost during monitoring, cleaning up...");
          if (mountedRef.current) {
            setUser(null);
            setKycStatus(null);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("❌ Session monitoring error:", error);
      }
    }, 120000); // Increased to 2 minutes

    return () => clearInterval(interval);
  }, [user, loading]);

  // Force refresh mechanism
  useEffect(() => {
    if (loading && user && hasInitialized.current && !isCheckingKYC.current) {
      forceRefreshTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && loading && user) {
          console.log("⚡ EMERGENCY - stuck loading detected");
          setRetryAttempts((prev) => prev + 1);
          setError(
            "Connection timeout. Please try refreshing the page or contact support if the issue persists."
          );
          setLoading(false);
        }
      }, 15000);
    } else {
      if (forceRefreshTimeoutRef.current) {
        clearTimeout(forceRefreshTimeoutRef.current);
        forceRefreshTimeoutRef.current = null;
      }
    }

    return () => {
      if (forceRefreshTimeoutRef.current) {
        clearTimeout(forceRefreshTimeoutRef.current);
      }
    };
  }, [loading, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (forceRefreshTimeoutRef.current) {
        clearTimeout(forceRefreshTimeoutRef.current);
      }
    };
  }, []);

  // Manual retry function
  const handleRetry = useCallback(async () => {
    if (!user) return;
    console.log("🔄 Manual retry triggered");
    setError(null);
    setLoading(true);

    if (forceRefreshTimeoutRef.current) {
      clearTimeout(forceRefreshTimeoutRef.current);
      forceRefreshTimeoutRef.current = null;
    }

    await forceFetchUserData(user.id);
  }, [user, forceFetchUserData]);

  const handleHardReload = useCallback(() => {
    console.log("🔄 HARD RELOAD triggered as last resort");
    window.location.reload();
  }, []);

  // Debug logs
  console.group("== Page Render ==");
  console.log("User:", user?.id || "null");
  console.log("KYC Status:", kycStatus);
  console.log("Loading:", loading);
  console.log("Tab Visible:", isTabVisible.current);
  console.log("Retry Attempts:", retryAttempts);
  console.log("Initialized:", hasInitialized.current);
  console.log("Mounted:", mountedRef.current);
  console.groupEnd();

  const LoadingScreen = ({ message }: { message: string }) => (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-gradient-to-br from-orange-50 to-orange-100">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F26623]"></div>
      <p className="text-gray-600 text-lg text-center">{message}</p>
      {error && (
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleRetry}
              className="bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Retry
            </button>
            {retryAttempts >= 2 && (
              <button
                onClick={handleHardReload}
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Hard Refresh
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const ErrorScreen = ({ message }: { message: string }) => (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-gradient-to-br from-red-50 to-red-100">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
        <svg
          className="w-8 h-8 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <p className="text-red-600 text-lg text-center max-w-md">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={handleRetry}
          className="bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => supabase.auth.signOut()}
          className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );

  // Show loading only when truly initializing
  if (loading && hasInitialized.current) {
    return <LoadingScreen message="Loading your account..." />;
  }

  // Show error screen if we have persistent errors
  if (error && !loading && retryAttempts >= 3) {
    return <ErrorScreen message={error} />;
  }

  if (!user) return <AuthForm />;

  if (kycStatus === "not_started") {
    return (
      <KYCVerification
        userId={user.id}
        onKYCComplete={() => {
          console.log("✅ KYC completed, loading dashboard...");
          setKycStatus("approved");
        }}
      />
    );
  }

  if (kycStatus === "pending") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            KYC Under Review
          </h1>
          <p className="text-gray-600 mb-4">
            Your KYC documents are being reviewed. This usually takes 1–3
            business days.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => supabase.auth.signOut()}
              className="block w-full text-[#F26623] hover:text-[#E55A1F] font-medium py-2"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (kycStatus === "rejected") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            KYC Verification Failed
          </h1>
          <p className="text-gray-600 mb-4">
            Your KYC verification was not approved. Please contact support or
            try again.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                console.log("🔄 Retrying KYC verification");
                setKycStatus("not_started");
              }}
              className="block w-full bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="block w-full text-[#F26623] hover:text-[#E55A1F] font-medium py-2"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  console.log("🎯 Loading dashboard for user:", user.id);
  return <Dashboard />;
}
