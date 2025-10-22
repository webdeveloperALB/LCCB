"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ReplaceCurrentPresenceTracker() {
  const [user, setUser] = useState<any>(null);
  const [status, setStatus] = useState<string>("Initializing...");
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const isOnlineRef = useRef(false);

  const updatePresenceWithRealLocation = async (
    userId: string,
    isOnline: boolean
  ) => {
    try {
      setStatus(isOnline ? "Getting location..." : "Going offline...");

      let locationData = {};

      if (isOnline) {
        // Get real IP address
        const ipResponse = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipResponse.json();
        const realIP = ipData.ip;

        setStatus(`Got IP: ${realIP}, getting location...`);

        // Get real location
        const locationResponse = await fetch(
          `https://ipapi.co/${realIP}/json/`
        );
        const locationInfo = await locationResponse.json();

        locationData = {
          ip_address: realIP,
          country: locationInfo.country_name || "Unknown",
          country_code: locationInfo.country_code || "",
          city: locationInfo.city || "Unknown",
          region: locationInfo.region || "",
        };

        setStatus(
          `Location: ${locationInfo.city}, ${locationInfo.country_name}`
        );
      }

      // Update database
      const { error } = await supabase.from("user_presence").upsert(
        {
          user_id: userId,
          is_online: isOnline,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...locationData,
        },
        { onConflict: "user_id" }
      );

      if (error) {
        console.error("Presence update error:", error);
        setStatus(`Error: ${error.message}`);
      } else {
        isOnlineRef.current = isOnline;
        setStatus(isOnline ? "✅ Online with location" : "✅ Offline");
        console.log("Presence updated successfully with real location");
      }
    } catch (error) {
      console.error("Location update failed:", error);
      setStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const startHeartbeat = (userId: string) => {
    // Update immediately
    updatePresenceWithRealLocation(userId, true);

    // Then update every 30 seconds
    heartbeatRef.current = setInterval(() => {
      console.log("Heartbeat - updating location");
      updatePresenceWithRealLocation(userId, true);
    }, 30000);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  useEffect(() => {
    const initializeTracking = async () => {
      // Get current user
      const { data: sessionData, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Error getting session:", error);
        return;
      }

      const user = sessionData.session?.user;
      setUser(user);

      if (user) {
        console.log("Starting real location tracking for user:", user.id);
        startHeartbeat(user.id);
      }
    };

    initializeTracking();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event);

      if (event === "SIGNED_OUT") {
        if (user?.id) {
          await updatePresenceWithRealLocation(user.id, false);
        }
        stopHeartbeat();
        setUser(null);
      } else if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        startHeartbeat(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
      stopHeartbeat();
    };
  }, []);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user?.id) {
        // Use sendBeacon for reliable offline marking
        navigator.sendBeacon(
          "/api/presence/offline",
          JSON.stringify({
            user_id: user.id,
            is_online: false,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [user]);

  // Show status in development
  if (process.env.NODE_ENV === "development") {
    return (
      <div className="fixed bottom-4 left-4 bg-green-600 text-white p-2 rounded text-xs max-w-xs z-50">
        Real Location Tracker: {status}
      </div>
    );
  }

  return null;
}
