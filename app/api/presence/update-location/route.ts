import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getLocationFromIP } from "@/lib/location-service"

export async function POST(request: NextRequest) {
  try {
    const { user_id, is_online, ip_address } = await request.json()

    if (!user_id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const timestamp = new Date().toISOString()
    let updateData: any = {
      user_id,
      is_online,
      last_seen: timestamp,
      updated_at: timestamp,
    }

    // If user is online and we have an IP, get location
    if (is_online && ip_address) {
      console.log("Getting location for IP:", ip_address)
      const locationInfo = await getLocationFromIP(ip_address)

      updateData = {
        ...updateData,
        ip_address: locationInfo.ip,
        country: locationInfo.country,
        country_code: locationInfo.country_code,
        city: locationInfo.city,
        region: locationInfo.region,
      }

      console.log("Saving location data:", updateData)
    }

    const { error } = await supabase.from("user_presence").upsert(updateData, { onConflict: "user_id" })

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
