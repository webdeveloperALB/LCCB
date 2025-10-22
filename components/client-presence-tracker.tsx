"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";

interface UsePresenceTrackerProps {
  userId: string;
  enabled?: boolean;
  heartbeatInterval?: number;
}

export function usePresenceTracker({
  userId,
  enabled = true,
  heartbeatInterval = 60000, // Increased to 60 seconds to reduce frequency
}: UsePresenceTrackerProps) {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const isOnlineRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const lastPresenceUpdateRef = useRef(0);
  const [userIP, setUserIP] = useState<string>("");
  const [locationData, setLocationData] = useState<any>(null);
  const [locationFetched, setLocationFetched] = useState(false);

  // Get user's IP address on component mount
  useEffect(() => {
    const getUserIPAndLocation = async () => {
      try {
        // ✅ Get session to ensure token is valid
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        const token = sessionData.session?.access_token;

        if (!user || !token) {
          console.warn("No authenticated user or token.");
          return;
        }

        // 🌐 Fetch IP address
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipJson = await ipRes.json();
        const ip = ipJson.ip;
        setUserIP(ip);
        console.log("User IP:", ip);

        // 🌍 Fetch location - only if successful
        let locationInfo: any = {
          ip_address: ip,
        };

        try {
          const locRes = await fetch(`https://ipapi.co/${ip}/json/`, {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            // Add timeout
            signal: AbortSignal.timeout(5000),
          });

          if (locRes.ok) {
            const loc = await locRes.json();

            // Only add location data if we got valid, real data
            if (loc && !loc.error && loc.country_name && loc.city) {
              locationInfo = {
                ...locationInfo,
                country: loc.country_name,
                country_code: loc.country_code,
                city: loc.city,
                region: loc.region,
              };
              console.log("Real location data fetched:", locationInfo);
            } else {
              console.log("Location API returned invalid data, using IP only");
            }
          } else {
            console.log("Location API request failed, using IP only");
          }
        } catch (locationError) {
          console.warn(
            "Could not fetch location data, using IP only:",
            locationError
          );
        }

        setLocationData(locationInfo);
        setLocationFetched(true);

        // ✅ Save to Supabase using supabase-js with active session
        const timestamp = new Date().toISOString();
        const { error } = await supabase.from("user_presence").upsert(
          {
            user_id: user.id,
            is_online: true,
            last_seen: timestamp,
            updated_at: timestamp,
            ...locationInfo,
          },
          {
            onConflict: "user_id",
          }
        );

        if (error) {
          console.error("Failed to upsert presence:", error);
        } else {
          console.log("Presence with location updated");
        }
      } catch (err) {
        console.error("Error during IP/location fetch or update:", err);
        setLocationFetched(true); // Ensure it doesn't block heartbeat
      }
    };

    if (enabled && userId) {
      getUserIPAndLocation();
    }
  }, [enabled, userId]);

  // Update presence in database WITH LOCATION - NEVER FORCE
  const updatePresence = useCallback(
    async (isOnline: boolean, force = false) => {
      if (!userId || !enabled) return;

      // Prevent too frequent updates (minimum 30 seconds between updates)
      const now = Date.now();
      if (!force && now - lastPresenceUpdateRef.current < 30000) {
        return;
      }

      try {
        const timestamp = new Date().toISOString();
        let updateData: any = {
          user_id: userId,
          is_online: isOnline,
          last_seen: timestamp,
          updated_at: timestamp,
        };

        // If user is coming online and we have cached location data, use it
        if (isOnline && locationData) {
          updateData = {
            ...updateData,
            ...locationData,
          };
        }

        // Use a simple update without any potential side effects
        await supabase.from("user_presence").upsert(updateData, {
          onConflict: "user_id",
        });

        isOnlineRef.current = isOnline;
        lastPresenceUpdateRef.current = now;
        console.log(`Presence updated: ${isOnline ? "online" : "offline"}`);
      } catch (error) {
        console.error("Error in updatePresence:", error);
        // Don't throw or cause any side effects on error
      }
    },
    [userId, enabled, locationData]
  );

  // Mark user offline (exposed function)
  const markOffline = useCallback(async () => {
    if (!userId) return;
    try {
      const timestamp = new Date().toISOString();
      await supabase.from("user_presence").upsert(
        {
          user_id: userId,
          is_online: false,
          last_seen: timestamp,
          updated_at: timestamp,
        },
        {
          onConflict: "user_id",
        }
      );
      isOnlineRef.current = false;
      console.log("User marked offline");
    } catch (error) {
      console.error("Error in markOffline:", error);
      // Don't throw or cause any side effects on error
    }
  }, [userId]);

  // Track user activity - SIMPLIFIED
  const handleActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    // Only mark online if user was offline - NO FORCED UPDATES
    if (!isOnlineRef.current) {
      updatePresence(true, false); // Never force
    }
  }, [updatePresence]);

  // Set up activity listeners - LESS AGGRESSIVE
  useEffect(() => {
    if (!enabled || !userId) return;

    const events = ["click", "keypress", "scroll"]; // Reduced events

    // More aggressive throttling
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledHandleActivity = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        handleActivity();
        throttleTimeout = null;
      }, 10000); // Throttle to once every 10 seconds
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

  // Set up heartbeat - LESS FREQUENT
  useEffect(() => {
    if (!enabled || !userId || !locationFetched) return;

    // Initial presence update - NO FORCE
    updatePresence(true, false);

    // Set up heartbeat
    heartbeatRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      const inactivityThreshold = 300000; // 5 minutes of inactivity

      if (timeSinceLastActivity > inactivityThreshold) {
        if (isOnlineRef.current) {
          updatePresence(false, false); // Never force
        }
      } else {
        if (!isOnlineRef.current) {
          updatePresence(true, false); // Never force
        } else {
          // Just update last_seen - NO FORCE
          updatePresence(true, false);
        }
      }
    }, heartbeatInterval);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [updatePresence, enabled, userId, heartbeatInterval, locationFetched]);

  // COMPLETELY REMOVED PAGE VISIBILITY HANDLER

  // SIMPLIFIED beforeunload - NO NAVIGATION TRIGGERS
  useEffect(() => {
    if (!enabled || !userId) return;

    const handleBeforeUnload = () => {
      // Simple beacon without any complex logic
      if (navigator.sendBeacon) {
        const data = JSON.stringify({
          user_id: userId,
          is_online: false,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        navigator.sendBeacon("/api/presence/offline", data);
      }
    };

    // Only use beforeunload, remove pagehide
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [userId, enabled]);

  return {
    updatePresence,
    markOffline,
    isOnline: isOnlineRef.current,
    userIP,
  };
}

// Main component - SIMPLIFIED
export default function PresenceTracker() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Store the presence tracker functions
  const { markOffline } = usePresenceTracker({
    userId: user?.id || "",
    enabled: !!user && !loading,
    heartbeatInterval: 60000, // Less frequent
  });

  // Get current user and set up auth listener - SIMPLIFIED
  useEffect(() => {
    let mounted = true;

    const getUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const session = await supabase.auth.getSession();
        console.log("Session token:", session.data?.session?.access_token);
        if (mounted) {
          setUser(user);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error getting user:", error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getUser();

    // Simplified auth listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        setUser(null);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setUser(session?.user || null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (user?.id) {
        markOffline();
      }
    };
  }, [user?.id, markOffline]);

  return null;
}

// Export a hook for manual logout handling
export function usePresenceLogout() {
  const markUserOffline = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      const timestamp = new Date().toISOString();
      await supabase.from("user_presence").upsert(
        {
          user_id: userId,
          is_online: false,
          last_seen: timestamp,
          updated_at: timestamp,
        },
        {
          onConflict: "user_id",
        }
      );
    } catch (error) {
      console.error("Error in manual logout presence update:", error);
    }
  }, []);

  return { markUserOffline };
}
