import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, is_online, last_seen } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check if user_presence record exists
    const { data: existingRecord, error: selectError } = await supabase
      .from("user_presence")
      .select("*")
      .eq("user_id", user_id)
      .single();

    const presenceData = {
      is_online,
      last_seen,
      updated_at: new Date().toISOString(),
    };

    if (existingRecord) {
      // Update existing record
      const { error: updateError } = await supabase
        .from("user_presence")
        .update(presenceData)
        .eq("user_id", user_id);

      if (updateError) {
        console.error("Error updating user presence:", updateError);
        return NextResponse.json(
          { error: "Failed to update presence" },
          { status: 500 }
        );
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from("user_presence")
        .insert({
          user_id,
          ...presenceData,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Error inserting user presence:", insertError);
        return NextResponse.json(
          { error: "Failed to create presence record" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
