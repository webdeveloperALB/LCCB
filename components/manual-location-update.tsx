"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { MapPin, Globe, Wifi } from "lucide-react";

export default function ManualLocationUpdate() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const updateMyLocationNow = async () => {
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
        setResult({ error: "Please log in first" });
        setLoading(false);
        return;
      }

      // Clear any sample data first
      await supabase
        .from("user_presence")
        .update({
          ip_address: null,
          country: null,
          country_code: null,
          city: null,
          region: null,
        })
        .eq("user_id", user.id);

      // Get real IP
      const ipResponse = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipResponse.json();
      const realIP = ipData.ip;

      // Get real location
      const locationResponse = await fetch(`https://ipapi.co/${realIP}/json/`);
      const locationInfo = await locationResponse.json();

      // Update with real data
      const updateData = {
        user_id: user.id,
        is_online: true,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ip_address: realIP,
        country: locationInfo.country_name || "Unknown",
        country_code: locationInfo.country_code || "",
        city: locationInfo.city || "Unknown",
        region: locationInfo.region || "",
      };

      const { data, error } = await supabase
        .from("user_presence")
        .upsert(updateData, { onConflict: "user_id" })
        .select();

      if (error) {
        setResult({ error: error.message });
      } else {
        setResult({
          success: true,
          realIP,
          location: `${locationInfo.city}, ${locationInfo.country_name}`,
          fullData: data[0],
        });
      }
    } catch (error) {
      setResult({
        error:
          error instanceof Error ? error.message : "Failed to update location",
      });
    }
    setLoading(false);
  };

  const clearSampleData = async () => {
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
        setResult({ error: "Please log in first" });
        setLoading(false);
        return;
      }

      // Clear location data
      const { error } = await supabase
        .from("user_presence")
        .update({
          ip_address: null,
          country: null,
          country_code: null,
          city: null,
          region: null,
        })
        .eq("user_id", user.id);

      if (error) {
        setResult({ error: error.message });
      } else {
        setResult({ success: true, message: "Sample data cleared" });
      }
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : "Failed to clear data",
      });
    }
    setLoading(false);
  };

  return (
    <Card className="max-w-2xl mx-auto mb-6">
      <CardHeader>
        <CardTitle className="flex items-center">
          <MapPin className="h-5 w-5 mr-2" />
          Manual Location Update
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Button
            onClick={updateMyLocationNow}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Wifi className="h-4 w-4 mr-2" />
            {loading ? "Updating..." : "Update My Real Location"}
          </Button>
          <Button
            onClick={clearSampleData}
            disabled={loading}
            variant="outline"
          >
            <Globe className="h-4 w-4 mr-2" />
            {loading ? "Clearing..." : "Clear Sample Data"}
          </Button>
        </div>

        {result && (
          <div className="space-y-2">
            <h3 className="font-semibold">Result:</h3>
            {result.success ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded">
                {result.realIP && (
                  <div className="text-sm">
                    <strong>Your Real IP:</strong> {result.realIP}
                  </div>
                )}
                {result.location && (
                  <div className="text-sm">
                    <strong>Your Real Location:</strong> {result.location}
                  </div>
                )}
                {result.message && (
                  <div className="text-sm">{result.message}</div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded">
                <strong>Error:</strong> {result.error}
              </div>
            )}
            <details className="text-xs">
              <summary className="cursor-pointer">Full Details</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
