"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useLocationPresenceTracker } from "@/hooks/use-location-presence-tracker"

export default function LocationPresenceProvider() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const { updatePresence, markOffline, clientIP } = useLocationPresenceTracker({
    userId: user?.id || "",
    enabled: !!user && !loading,
    heartbeatInterval: 30000,
  })

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
      console.log("User loaded:", user?.id)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event)

      if (event === "SIGNED_OUT") {
        if (user?.id) {
          console.log("User signing out, marking offline")
          await markOffline()
        }
      }

      if (event === "TOKEN_REFRESHED") {
        return
      }

      setUser(session?.user || null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [user, markOffline])

  useEffect(() => {
    return () => {
      if (user?.id) {
        markOffline()
      }
    }
  }, [user?.id, markOffline])

  // Debug info
  useEffect(() => {
    if (user && clientIP) {
      console.log("Location presence provider active:", { userId: user.id, clientIP })
    }
  }, [user, clientIP])

  return null
}
