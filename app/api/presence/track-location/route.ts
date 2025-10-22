import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractIPFromRequest, getLocationData } from "@/lib/geolocation-fixed";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, is_online, client_ip } = body;

    console.log("Location tracking request:", {
      user_id,
      is_online,
      client_ip,
    });

    if (!user_id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    let updateData: any = {
      user_id,
      is_online,
      last_seen: timestamp,
      updated_at: timestamp,
    };

    // Determine IP address
    const ipAddress = client_ip || extractIPFromRequest(request);
    console.log("Final IP address:", ipAddress);

    // Fetch location data if user is online
    if (is_online && ipAddress) {
      let locationData: {
        ip?: string;
        country?: string;
        country_code?: string;
        city?: string;
        region?: string;
      } = {};

      try {
        console.log("Getting location data for IP:", ipAddress);
        locationData = await getLocationData(ipAddress);

        updateData = {
          ...updateData,
          ip_address: locationData.ip || ipAddress,
          country: locationData.country || null,
          country_code: locationData.country_code || null,
          city: locationData.city || null,
          region: locationData.region || null,
        };

        console.log("Location data to save:", updateData);
      } catch (locationError) {
        console.error("Error getting location data:", locationError);
        updateData.ip_address = ipAddress;
      }
    }

    // Save to Supabase
    const { data, error } = await supabase
      .from("user_presence")
      .upsert(updateData, { onConflict: "user_id" })
      .select();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to update presence" },
        { status: 500 }
      );
    }

    console.log("Successfully updated presence:", data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error in location tracking API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
