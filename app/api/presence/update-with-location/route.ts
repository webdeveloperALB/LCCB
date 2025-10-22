import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  extractIPFromRequest,
  getLocationData,
} from "@/lib/enhanced-geolocation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, is_online, last_seen, updated_at } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get IP address from request
    const ipAddress = body.ip_address || extractIPFromRequest(request);

    // Get location data if IP is available and user is coming online
    let locationData = {};
    if (ipAddress && is_online) {
      try {
        locationData = await getLocationData(ipAddress);
      } catch (error) {
        console.error("Error getting location data:", error);
        locationData = { ip_address: ipAddress };
      }
    }

    const { error } = await supabase.from("user_presence").upsert(
      {
        user_id,
        is_online,
        last_seen,
        updated_at,
        ...locationData,
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      console.error("Error updating presence:", error);
      return NextResponse.json(
        { error: "Failed to update presence" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in presence API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
