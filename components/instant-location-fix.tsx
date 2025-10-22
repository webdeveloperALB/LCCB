"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export default function InstantLocationFix() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const updateLocationNow = async () => {
    setLoading(true);
    try {
      // Get current user
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        setResult({ error: sessionError.message });
        setLoading(false);
        return;
      }

      const user = sessionData.session?.user;
      if (!user) {
        setResult({ error: "No user logged in" });
        setLoading(false);
        return;
      }

      console.log("Updating location for user:", user.id);

      // Get IP address
      const ipResponse = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipResponse.json();
      const userIP = ipData.ip;

      console.log("Got IP:", userIP);

      // Get location data
      const locationResponse = await fetch(`https://ipapi.co/${userIP}/json/`);
      const locationData = await locationResponse.json();

      console.log("Got location:", locationData);

      // Update database with location
      const updateData = {
        user_id: user.id,
        is_online: true,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ip_address: userIP,
        country: locationData.country_name || "Unknown",
        country_code: locationData.country_code || "XX",
        city: locationData.city || "Unknown",
        region: locationData.region || "Unknown",
      };

      console.log("Updating database with:", updateData);

      const { data, error } = await supabase
        .from("user_presence")
        .upsert(updateData, { onConflict: "user_id" })
        .select();

      if (error) {
        console.error("Database error:", error);
        setResult({ error: error.message, updateData });
      } else {
        console.log("Database updated successfully:", data);
        setResult({
          success: true,
          ip: userIP,
          location: locationData,
          saved: data[0],
        });
      }
    } catch (error) {
      console.error("Update failed:", error);
      setResult({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    setLoading(false);
  };

  const checkCurrentData = async () => {
    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        setResult({ error: sessionError.message });
        setLoading(false);
        return;
      }

      const user = sessionData.session?.user;
      if (!user) {
        setResult({ error: "No user logged in" });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_presence")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        setResult({ error: error.message });
      } else {
        setResult({ currentData: data });
      }
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    setLoading(false);
  };

  return (
    <Card className="max-w-2xl mx-auto mb-6">
      <CardHeader>
        <CardTitle>🚨 Instant Location Fix</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Button
            onClick={updateLocationNow}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? "Updating..." : "🔥 UPDATE LOCATION NOW"}
          </Button>
          <Button
            onClick={checkCurrentData}
            disabled={loading}
            variant="outline"
          >
            {loading ? "Checking..." : "Check Current Data"}
          </Button>
        </div>

        {result && (
          <div className="space-y-2">
            <h3 className="font-semibold">Result:</h3>
            <pre className="p-4 bg-gray-100 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
