"use client"
import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getUserIP } from "@/lib/location-service"

export default function WorkingPresenceTracker() {
  const [user, setUser] = useState<any>(null)
  const [userIP, setUserIP] = useState<string>("")
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const isOnlineRef = useRef(false)

  // Get user and IP on mount
  useEffect(() => {
    const initializeTracking = async () => {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        // Get user's IP
        const ip = await getUserIP()
        setUserIP(ip)
        console.log("User IP detected:", ip)

        // Mark user as online with location
        await updatePresenceWithLocation(user.id, true, ip)

        // Start heartbeat
        startHeartbeat(user.id, ip)
      }
    }

    initializeTracking()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        if (user?.id) {
          await updatePresenceWithLocation(user.id, false, userIP)
        }
        stopHeartbeat()
      } else if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user)
        const ip = await getUserIP()
        setUserIP(ip)
        await updatePresenceWithLocation(session.user.id, true, ip)
        startHeartbeat(session.user.id, ip)
      }
    })

    return () => {
      subscription.unsubscribe()
      stopHeartbeat()
    }
  }, [])

  const updatePresenceWithLocation = async (userId: string, isOnline: boolean, ipAddress: string) => {
    try {
      console.log("Updating presence:", { userId, isOnline, ipAddress })

      const response = await fetch("/api/presence/update-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          is_online: isOnline,
          ip_address: ipAddress,
        }),
      })

      const result = await response.json()
      console.log("Presence update result:", result)

      isOnlineRef.current = isOnline
    } catch (error) {
      console.error("Failed to update presence:", error)
    }
  }

  const startHeartbeat = (userId: string, ipAddress: string) => {
    heartbeatRef.current = setInterval(() => {
      console.log("Heartbeat - keeping user online")
      updatePresenceWithLocation(userId, true, ipAddress)
    }, 30000) // Every 30 seconds
  }

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user?.id) {
        // Use sendBeacon for reliable offline marking
        navigator.sendBeacon(
          "/api/presence/update-location",
          JSON.stringify({
            user_id: user.id,
            is_online: false,
            ip_address: userIP,
          }),
        )
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [user, userIP])

  return null // This component doesn't render anything
}
