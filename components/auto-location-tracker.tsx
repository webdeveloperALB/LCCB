"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AutoLocationTracker() {
  const [status, setStatus] = useState<string>("Initializing...");

  useEffect(() => {
    const updateLocation = async () => {
      try {
        setStatus("Getting session...");

        // ✅ Get full session to ensure auth token exists
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const user = sessionData.session?.user;
        if (!user) {
          setStatus("No user logged in");
          return;
        }

        setStatus("Getting IP address...");

        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipJson = await ipRes.json();
        const ip = ipJson.ip;

        setStatus(`Got IP: ${ip}, getting location...`);

        const locRes = await fetch(`https://ipapi.co/${ip}/json/`);
        const loc = await locRes.json();

        const locationInfo = {
          ip_address: ip,
          country: loc.country_name || "Unknown",
          country_code: loc.country_code || "XX",
          city: loc.city || "Unknown",
          region: loc.region || "Unknown",
        };

        setStatus(
          `Saving location: ${locationInfo.city}, ${locationInfo.country}...`
        );

        const timestamp = new Date().toISOString();
        const { error: upsertError } = await supabase
          .from("user_presence")
          .upsert(
            {
              user_id: user.id,
              is_online: true,
              last_seen: timestamp,
              updated_at: timestamp,
              ...locationInfo,
            },
            { onConflict: "user_id" }
          );

        if (upsertError) {
          console.error("Upsert failed:", upsertError);
          setStatus(`❌ DB Error: ${upsertError.message}`);
        } else {
          setStatus(
            `✅ Location saved: ${locationInfo.city}, ${locationInfo.country}`
          );
          console.log("Location upserted:", locationInfo);
        }
      } catch (err) {
        console.error("Location tracking failed:", err);
        setStatus(
          `❌ Error: ${err instanceof Error ? err.message : "Unknown"}`
        );
      }
    };

    updateLocation();
    const interval = setInterval(updateLocation, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white p-2 rounded text-xs max-w-xs">
      Location Tracker: {status}
    </div>
  );
}
