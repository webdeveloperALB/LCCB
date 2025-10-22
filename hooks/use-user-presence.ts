"use client";
import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface UseEnhancedPresenceTrackerProps {
  userId: string;
  enabled?: boolean;
  heartbeatInterval?: number;
}

export function useEnhancedPresenceTracker({
  userId,
  enabled = true,
  heartbeatInterval = 30000,
}: UseEnhancedPresenceTrackerProps) {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const isOnlineRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const lastPresenceUpdateRef = useRef(0);

  // Update presence with location data
  const updatePresenceWithLocation = useCallback(
    async (isOnline: boolean, force = false) => {
      if (!userId || !enabled) return;

      const now = Date.now();
      if (!force && now - lastPresenceUpdateRef.current < 10000) {
        return;
      }

      try {
        const timestamp = new Date().toISOString();

        // Use the new API endpoint that includes location tracking
        const response = await fetch("/api/presence/update-with-location", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            is_online: isOnline,
            last_seen: timestamp,
            updated_at: timestamp,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update presence");
        }

        console.log(
          `Enhanced presence updated: ${
            isOnline ? "online" : "offline"
          } for user ${userId}`
        );
        isOnlineRef.current = isOnline;
        lastPresenceUpdateRef.current = now;
      } catch (error) {
        console.error("Error in updatePresenceWithLocation:", error);

        // Fallback to direct Supabase update without location
        try {
          const timestamp = new Date().toISOString();
          const { error: fallbackError } = await supabase
            .from("user_presence")
            .upsert(
              {
                user_id: userId,
                is_online: isOnline,
                last_seen: timestamp,
                updated_at: timestamp,
              },
              {
                onConflict: "user_id",
              }
            );

          if (fallbackError) {
            console.error("Fallback presence update error:", fallbackError);
          } else {
            isOnlineRef.current = isOnline;
            lastPresenceUpdateRef.current = now;
          }
        } catch (fallbackError) {
          console.error("Error in fallback presence update:", fallbackError);
        }
      }
    },
    [userId, enabled]
  );

  // Mark user offline
  const markOffline = useCallback(async () => {
    if (!userId) return;

    console.log("Marking user offline:", userId);
    await updatePresenceWithLocation(false, true);
  }, [userId, updatePresenceWithLocation]);

  // Track user activity
  const handleActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    if (!isOnlineRef.current) {
      console.log("User became active, marking online with location");
      updatePresenceWithLocation(true);
    }
  }, [updatePresenceWithLocation]);

  // Set up activity listeners (same as before)
  useEffect(() => {
    if (!enabled || !userId) return;

    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
      "focus",
    ];

    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledHandleActivity = () => {
      if (throttleTimeout) return;

      throttleTimeout = setTimeout(() => {
        handleActivity();
        throttleTimeout = null;
      }, 3000);
    };

    events.forEach((event) => {
      document.addEventListener(event, throttledHandleActivity, true);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledHandleActivity, true);
      });
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [handleActivity, enabled, userId]);

  // Set up heartbeat with location tracking
  useEffect(() => {
    if (!enabled || !userId) return;

    // Initial presence update with location
    updatePresenceWithLocation(true, true);

    heartbeatRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      const inactivityThreshold = 120000; // 2 minutes

      if (timeSinceLastActivity > inactivityThreshold) {
        if (isOnlineRef.current) {
          console.log("User inactive for 2+ minutes, marking offline");
          updatePresenceWithLocation(false, true);
        }
      } else {
        if (!isOnlineRef.current) {
          console.log("User has recent activity, marking online with location");
          updatePresenceWithLocation(true, true);
        } else {
          console.log("User still active, updating presence");
          updatePresenceWithLocation(true);
        }
      }
    }, heartbeatInterval);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [updatePresenceWithLocation, enabled, userId, heartbeatInterval]);

  // Handle page visibility changes
  useEffect(() => {
    if (!enabled || !userId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("Page hidden, will mark offline in 60 seconds");
        setTimeout(() => {
          if (document.hidden) {
            console.log("Page still hidden after 60s, marking offline");
            updatePresenceWithLocation(false, true);
          }
        }, 60000);
      } else {
        console.log("Page visible, marking online with location");
        lastActivityRef.current = Date.now();
        updatePresenceWithLocation(true, true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [updatePresenceWithLocation, enabled, userId]);

  // Handle beforeunload
  useEffect(() => {
    if (!enabled || !userId) return;

    const handleBeforeUnload = () => {
      console.log("Page unloading, marking offline");
      const data = JSON.stringify({
        user_id: userId,
        is_online: false,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/presence/offline", data);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
    };
  }, [userId]);

  return {
    updatePresence: updatePresenceWithLocation,
    markOffline,
    isOnline: isOnlineRef.current,
  };
}
