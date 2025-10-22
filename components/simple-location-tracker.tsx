"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SimpleLocationTracker() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Get current user
    supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (error) {
        console.error("Error getting session:", error);
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
  }, []);

  const updateLocationNow = async (userId: string) => {
    try {
      console.log("Updating location for user:", userId);

      // Get IP
      const ipResponse = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipResponse.json();
      const userIP = ipData.ip;

      console.log("User IP:", userIP);

      // Get location
      const locationResponse = await fetch(`https://ipapi.co/${userIP}/json/`);
      const locationData = await locationResponse.json();

      console.log("Location data:", locationData);

      // Update database directly
      const { error } = await supabase.from("user_presence").upsert(
        {
          user_id: userId,
          is_online: true,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ip_address: userIP,
          country: locationData.country_name || "Unknown",
          country_code: locationData.country_code || "",
          city: locationData.city || "Unknown",
          region: locationData.region || "",
        },
        { onConflict: "user_id" }
      );

      if (error) {
        console.error("Database update error:", error);
      } else {
        console.log("Location updated successfully");
      }
    } catch (error) {
      console.error("Location update failed:", error);
    }
  };

  return null;
}
