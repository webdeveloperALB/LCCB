"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserIP, getLocationFromIP } from "@/lib/location-service";
import { supabase } from "@/lib/supabase";

export default function LocationTest() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testFullFlow = async () => {
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

      // Get IP
      const ip = await getUserIP();
      console.log("IP:", ip);

      // Get location
      const location = await getLocationFromIP(ip);
      console.log("Location:", location);

      // Update presence
      const response = await fetch("/api/presence/update-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          is_online: true,
          ip_address: ip,
        }),
      });

      const apiResult = await response.json();
      console.log("API result:", apiResult);

      // Check database
      const { data: presenceData } = await supabase
        .from("user_presence")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setResult({
        user_id: user.id,
        ip,
        location,
        apiResult,
        presenceData,
      });
    } catch (error) {
      setResult({
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
    setLoading(false);
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Location Tracking Test</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={testFullFlow} disabled={loading}>
          {loading ? "Testing..." : "Test Location Tracking"}
        </Button>

        {result && (
          <pre className="mt-4 p-4 bg-gray-100 rounded text-xs overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
