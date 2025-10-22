"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RealLocationTracker() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const updateLocationNow = async (userId: string) => {
      try {
        console.log("Updating real location for user:", userId);

        // Get real IP
        const ipResponse = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipResponse.json();
        const realIP = ipData.ip;

        // Get real location
        const locationResponse = await fetch(
          `https://ipapi.co/${realIP}/json/`
        );
        const locationInfo = await locationResponse.json();

        // Update database
        const { error } = await supabase.from("user_presence").upsert(
          {
            user_id: userId,
            is_online: true,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ip_address: realIP,
            country: locationInfo.country_name || "Unknown",
            country_code: locationInfo.country_code || "",
            city: locationInfo.city || "Unknown",
            region: locationInfo.region || "",
          },
          { onConflict: "user_id" }
        );

        if (error) {
          console.error("Location update error:", error);
        } else {
          console.log("Real location updated successfully");
        }
      } catch (error) {
        console.error("Failed to update location:", error);
      }
    };

    // Get current user and start tracking
    supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (error) {
        console.error("Failed to get session:", error);
        return;
      }

      const user = sessionData.session?.user;
      setUser(user);

      if (user) {
        updateLocationNow(user.id);
        const interval = setInterval(() => {
          updateLocationNow(user.id);
        }, 30000);

        return () => clearInterval(interval);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        updateLocationNow(session.user.id);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
