"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getClientIPAddress } from "@/lib/geolocation-fixed";

interface UseLocationPresenceTrackerProps {
  userId: string;
  enabled?: boolean;
  heartbeatInterval?: number;
}

export function useLocationPresenceTracker({
  userId,
  enabled = true,
  heartbeatInterval = 30000,
}: UseLocationPresenceTrackerProps) {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const isOnlineRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const lastPresenceUpdateRef = useRef(0);
  const [clientIP, setClientIP] = useState<string>("");

  // Get client IP on mount
  useEffect(() => {
    if (enabled && userId) {
      getClientIPAddress().then((ip) => {
        console.log("Client IP obtained:", ip);
        setClientIP(ip);
      });
    }
  }, [enabled, userId]);

  // Update presence with location tracking
  const updatePresenceWithLocation = useCallback(
    async (isOnline: boolean, force = false) => {
      if (!userId || !enabled) return;

      const now = Date.now();
      if (!force && now - lastPresenceUpdateRef.current < 10000) {
        return;
      }

      try {
        console.log("Updating presence with location:", {
          userId,
          isOnline,
          clientIP,
        });

        // Use the location tracking API
        const response = await fetch("/api/presence/track-location-fixed", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            is_online: isOnline,
            client_ip: clientIP,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("Presence update result:", result);

        isOnlineRef.current = isOnline;
        lastPresenceUpdateRef.current = now;
      } catch (error) {
        console.error("Error updating presence with location:", error);

        // Fallback to direct Supabase update
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
              { onConflict: "user_id" }
            );

          if (!fallbackError) {
            isOnlineRef.current = isOnline;
            lastPresenceUpdateRef.current = now;
          }
        } catch (fallbackError) {
          console.error("Fallback presence update failed:", fallbackError);
        }
      }
    },
    [userId, enabled, clientIP]
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

  // Set up activity listeners
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

  // Set up heartbeat
  useEffect(() => {
    if (!enabled || !userId) return;

    // Initial presence update
    console.log("Setting up presence tracking for user:", userId);
    updatePresenceWithLocation(true, true);

    heartbeatRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      const inactivityThreshold = 120000; // 2 minutes

      console.log(`Heartbeat: ${timeSinceLastActivity}ms since last activity`);

      if (timeSinceLastActivity > inactivityThreshold) {
        if (isOnlineRef.current) {
          console.log("User inactive, marking offline");
          updatePresenceWithLocation(false, true);
        }
      } else {
        if (!isOnlineRef.current) {
          console.log("User active, marking online");
          lastActivityRef.current = Date.now();
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
        console.log("Page hidden");
        setTimeout(() => {
          if (document.hidden) {
            updatePresenceWithLocation(false, true);
          }
        }, 60000);
      } else {
        console.log("Page visible, marking online");
        lastActivityRef.current = Date.now();
        updatePresenceWithLocation(true, true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [updatePresenceWithLocation, enabled, userId]);

  return {
    updatePresence: updatePresenceWithLocation,
    markOffline,
    isOnline: isOnlineRef.current,
    clientIP,
  };
}
