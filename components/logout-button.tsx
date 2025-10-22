"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { usePresenceLogout } from "./client-presence-tracker"
import { LogOut } from "lucide-react"

export default function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { markUserOffline } = usePresenceLogout()

  const handleLogout = async () => {
    setIsLoggingOut(true)

    try {
      // Get current user before signing out
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        console.log("Logging out user:", user.id)

        // First mark user as offline
        await markUserOffline(user.id)

        // Small delay to ensure the presence update completes
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      // Then sign out
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("Error signing out:", error)
      } else {
        console.log("Successfully signed out")
        // Redirect or handle successful logout
        window.location.href = "/login" // or use your router
      }
    } catch (error) {
      console.error("Error during logout:", error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <Button
      onClick={handleLogout}
      disabled={isLoggingOut}
      variant="outline"
      className="flex items-center space-x-2 bg-transparent"
    >
      <LogOut className="h-4 w-4" />
      <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
    </Button>
  )
}
