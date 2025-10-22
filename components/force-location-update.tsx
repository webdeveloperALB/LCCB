"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export default function ForceLocationUpdate() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const forceUpdateLocation = async () => {
    setLoading(true);
    try {
      // Get current user
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        setResult({ error: sessionError.message });
        return;
      }

      const user = sessionData.session?.user;
      if (!user) {
        setResult({ error: "No user logged in" });
        return;
      }

      // Get IP from external service
      const ipResponse = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipResponse.json();
      const userIP = ipData.ip;

      // Get location from IP
      const locationResponse = await fetch(`https://ipapi.co/${userIP}/json/`);
      const locationData = await locationResponse.json();

      // Directly update the database
      const { data, error } = await supabase
        .from("user_presence")
        .upsert(
          {
            user_id: user.id,
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
        )
        .select();

      if (error) {
        setResult({ error: error.message });
      } else {
        setResult({
          success: true,
          ip: userIP,
          location: locationData,
          dbResult: data,
        });
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
        <CardTitle>Force Location Update</CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          onClick={forceUpdateLocation}
          disabled={loading}
          className="mb-4"
        >
          {loading ? "Updating..." : "Force Update My Location"}
        </Button>

        {result && (
          <div className="space-y-2">
            <pre className="p-4 bg-gray-100 rounded text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
