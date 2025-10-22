"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function PresenceStatusDebug() {
  const [user, setUser] = useState<any>(null);
  const [presenceData, setPresenceData] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!user) return;

    const checkPresence = async () => {
      const { data } = await supabase
        .from("user_presence")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setPresenceData(data);
    };

    checkPresence();
    const interval = setInterval(checkPresence, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [user]);

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="fixed bottom-4 left-4 bg-black text-white p-3 rounded text-xs max-w-sm z-50">
      <div className="font-bold mb-2">Presence Debug:</div>
      {user ? (
        <div>
          <div>User: {user.email}</div>
          {presenceData ? (
            <div className="mt-2">
              <div>Online: {presenceData.is_online ? "✅" : "❌"}</div>
              <div>IP: {presenceData.ip_address || "❌ Not set"}</div>
              <div>Country: {presenceData.country || "❌ Not set"}</div>
              <div>City: {presenceData.city || "❌ Not set"}</div>
              <div>
                Updated:{" "}
                {new Date(presenceData.updated_at).toLocaleTimeString()}
              </div>
            </div>
          ) : (
            <div>No presence data</div>
          )}
        </div>
      ) : (
        <div>No user logged in</div>
      )}
    </div>
  );
}
