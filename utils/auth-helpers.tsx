import { supabase } from "@/lib/supabase"

export async function logoutUser() {
  try {
    // Get current user before signing out
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      console.log("Logging out user:", user.id)

      // Mark user as offline before signing out
      const timestamp = new Date().toISOString()
      await supabase.from("user_presence").upsert(
        {
          user_id: user.id,
          is_online: false,
          last_seen: timestamp,
          updated_at: timestamp,
        },
        {
          onConflict: "user_id",
        },
      )

      console.log("Marked user offline before logout")

      // Small delay to ensure the presence update completes
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // Then sign out
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error("Error signing out:", error)
      throw error
    }

    console.log("Successfully signed out")
    return { success: true }
  } catch (error) {
    console.error("Error during logout:", error)
    return { success: false, error }
  }
}
