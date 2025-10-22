"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

interface SessionState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  isRefreshing: boolean;
}

export function useSessionManager() {
  const [sessionState, setSessionState] = useState<SessionState>({
    user: null,
    session: null,
    loading: true,
    error: null,
    isRefreshing: false,
  });

  // Refs for cleanup and state management
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isRefreshingRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const lastRefreshAttemptRef = useRef<number>(0);
  const currentSessionRef = useRef<Session | null>(null);

  // Constants for timing (centralized configuration)
  const REFRESH_COOLDOWN = 5000; // 5 seconds minimum between refresh attempts
  const SESSION_REFRESH_THRESHOLD = 10 * 60 * 1000; // 10 minutes before expiry
  const ACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes of inactivity
  const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes heartbeat
  const VALIDATION_INTERVAL = 15 * 60 * 1000; // 15 minutes validation check

  // Clear all timers utility
  const clearAllTimers = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Update session state safely
  const updateSessionState = useCallback((updates: Partial<SessionState>) => {
    if (!mountedRef.current) return;

    setSessionState((prev) => {
      const newState = { ...prev, ...updates };
      // Update ref for immediate access
      currentSessionRef.current = newState.session;
      return newState;
    });
  }, []);

  // Proactive session refresh function
  const refreshSession = useCallback(
    async (force = false): Promise<Session | null> => {
      // Prevent excessive refresh attempts
      const now = Date.now();
      if (!force && now - lastRefreshAttemptRef.current < REFRESH_COOLDOWN) {
        console.log("Refresh cooldown active, skipping...");
        return currentSessionRef.current;
      }

      // Prevent multiple simultaneous refresh attempts
      if (isRefreshingRef.current && !force) {
        console.log("Session refresh already in progress, skipping...");
        return currentSessionRef.current;
      }

      if (!mountedRef.current) {
        console.log("Component unmounted, skipping refresh...");
        return null;
      }

      isRefreshingRef.current = true;
      lastRefreshAttemptRef.current = now;
      updateSessionState({ isRefreshing: true, error: null });

      try {
        console.log("Refreshing Supabase session...");

        // Get current session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!mountedRef.current) return null;

        if (sessionError) {
          console.error("Session fetch error:", sessionError);
          throw new Error(`Session fetch failed: ${sessionError.message}`);
        }

        if (!session) {
          console.log("No active session found");
          updateSessionState({
            user: null,
            session: null,
            loading: false,
            error: null,
            isRefreshing: false,
          });
          clearAllTimers();
          return null;
        }

        // Check if session needs refresh
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
        const timeUntilExpiry = expiresAt - now;
        const shouldRefresh = timeUntilExpiry < SESSION_REFRESH_THRESHOLD;

        if (shouldRefresh || force) {
          console.log("Session needs refresh, refreshing token...");

          const { data: refreshData, error: refreshError } =
            await supabase.auth.refreshSession();

          if (!mountedRef.current) return null;

          if (refreshError) {
            console.error("Session refresh error:", refreshError);
            throw new Error(`Session refresh failed: ${refreshError.message}`);
          }

          if (refreshData.session) {
            console.log("Session refreshed successfully");
            updateSessionState({
              user: refreshData.session.user,
              session: refreshData.session,
              loading: false,
              error: null,
              isRefreshing: false,
            });

            scheduleNextRefresh(refreshData.session);
            return refreshData.session;
          }
        } else {
          // Session is still valid
          console.log("Session still valid");
          updateSessionState({
            user: session.user,
            session: session,
            loading: false,
            error: null,
            isRefreshing: false,
          });

          scheduleNextRefresh(session);
          return session;
        }
      } catch (error: any) {
        console.error("Session refresh failed:", error);
        if (mountedRef.current) {
          updateSessionState({
            user: null,
            session: null,
            loading: false,
            error: error.message || "Session refresh failed",
            isRefreshing: false,
          });
        }
        clearAllTimers();
        return null;
      } finally {
        isRefreshingRef.current = false;
      }

      return null;
    },
    [] // Remove sessionState.session dependency to prevent cycles
  );

  // Schedule the next automatic refresh
  const scheduleNextRefresh = useCallback(
    (session: Session) => {
      if (!mountedRef.current) return;

      clearAllTimers();

      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      // Schedule refresh for halfway to expiry, but not more than 15 minutes
      const refreshIn = Math.min(
        Math.max(timeUntilExpiry / 2, 60000), // At least 1 minute, at most half the time to expiry
        VALIDATION_INTERVAL // But never more than 15 minutes
      );

      if (refreshIn > 0 && timeUntilExpiry > SESSION_REFRESH_THRESHOLD) {
        console.log(
          `Scheduling next session refresh in ${Math.round(
            refreshIn / 1000 / 60
          )} minutes`
        );
        refreshTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            refreshSession(false);
          }
        }, refreshIn);
      }
    },
    [refreshSession, clearAllTimers]
  );

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Initialize session and set up listeners
  useEffect(() => {
    mountedRef.current = true;

    const initializeSession = async () => {
      if (!mountedRef.current) return;

      try {
        console.log("Initializing session...");
        await refreshSession(true);
      } catch (error) {
        console.error("Failed to initialize session:", error);
        if (mountedRef.current) {
          updateSessionState({ loading: false });
        }
      }
    };

    initializeSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event);

      if (!mountedRef.current) return;

      if (event === "SIGNED_OUT" || !session) {
        updateSessionState({
          user: null,
          session: null,
          loading: false,
          error: null,
          isRefreshing: false,
        });
        clearAllTimers();
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        updateSessionState({
          user: session.user,
          session: session,
          loading: false,
          error: null,
          isRefreshing: false,
        });
        scheduleNextRefresh(session);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      clearAllTimers();
    };
  }, []); // Remove all dependencies to prevent re-initialization

  // Set up activity-based session management
  useEffect(() => {
    const activityEvents = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    const handleActivity = () => {
      updateActivity();
    };

    // Add activity listeners
    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Set up heartbeat for active users
    const heartbeatInterval = setInterval(() => {
      if (!mountedRef.current || !currentSessionRef.current) return;

      const timeSinceLastActivity = Date.now() - lastActivityRef.current;

      // Only refresh if user has been active recently and session exists
      if (timeSinceLastActivity < ACTIVITY_TIMEOUT) {
        const expiresAt = currentSessionRef.current.expires_at
          ? currentSessionRef.current.expires_at * 1000
          : 0;
        const timeUntilExpiry = expiresAt - Date.now();

        // Only refresh if close to expiry
        if (timeUntilExpiry < SESSION_REFRESH_THRESHOLD) {
          console.log("Heartbeat refresh - session close to expiry");
          refreshSession(false);
        }
      }
    }, HEARTBEAT_INTERVAL);

    heartbeatIntervalRef.current = heartbeatInterval;

    return () => {
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [refreshSession, updateActivity]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && currentSessionRef.current && mountedRef.current) {
        console.log("Tab became visible, checking session...");
        updateActivity();

        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        const expiresAt = currentSessionRef.current.expires_at
          ? currentSessionRef.current.expires_at * 1000
          : 0;
        const timeUntilExpiry = expiresAt - Date.now();

        // Only refresh if session is close to expiry or user was inactive too long
        if (
          timeUntilExpiry < SESSION_REFRESH_THRESHOLD ||
          timeSinceLastActivity > ACTIVITY_TIMEOUT
        ) {
          await refreshSession(true);
        }
      }
    };

    const handleFocus = async () => {
      if (currentSessionRef.current && mountedRef.current) {
        updateActivity();

        const expiresAt = currentSessionRef.current.expires_at
          ? currentSessionRef.current.expires_at * 1000
          : 0;
        const timeUntilExpiry = expiresAt - Date.now();

        // Only refresh if close to expiry
        if (timeUntilExpiry < SESSION_REFRESH_THRESHOLD) {
          await refreshSession(false);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshSession, updateActivity]);

  // Manual refresh function for components
  const manualRefresh = useCallback(async () => {
    return await refreshSession(true);
  }, [refreshSession]);

  // Sign out with cleanup
  const signOut = useCallback(async () => {
    clearAllTimers();

    // Clean up presence tracking
    if (window.presenceCleanup) {
      window.presenceCleanup();
    }

    updateSessionState({
      user: null,
      session: null,
      loading: false,
      error: null,
      isRefreshing: false,
    });

    await supabase.auth.signOut();
  }, [clearAllTimers, updateSessionState]);

  return {
    user: sessionState.user,
    session: sessionState.session,
    loading: sessionState.loading,
    error: sessionState.error,
    isRefreshing: sessionState.isRefreshing,
    refreshSession: manualRefresh,
    signOut,
    updateActivity,
  };
}
