"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Global presence manager to handle user session tracking
export default function PresenceManager() {
  useEffect(() => {
    let currentUserId: string | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    let cleanupFunctions: (() => void)[] = [];

    // Function to update user presence
    const updatePresence = async (userId: string, isOnline: boolean) => {
      try {
        const { error } = await supabase.from("user_presence").upsert(
          {
            user_id: userId,
            is_online: isOnline,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

        if (error) {
          console.error("Presence update error:", error);
        }
      } catch (error) {
        console.error("Error updating presence:", error);
      }
    };

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Clear previous cleanup functions
      cleanupFunctions.forEach((cleanup) => cleanup());
      cleanupFunctions = [];

      if (event === "SIGNED_IN" && session?.user) {
        currentUserId = session.user.id;

        // Mark user as online
        await updatePresence(currentUserId, true);

        // Set up heartbeat to maintain online status
        heartbeatInterval = setInterval(() => {
          if (currentUserId) {
            updatePresence(currentUserId, true);
          }
        }, 30000); // Every 30 seconds

        // Handle page visibility changes
        const handleVisibilityChange = () => {
          if (currentUserId) {
            if (document.hidden) {
              updatePresence(currentUserId, false);
            } else {
              updatePresence(currentUserId, true);
            }
          }
        };

        // Handle page unload
        const handleBeforeUnload = () => {
          if (currentUserId) {
            updatePresence(currentUserId, false);
          }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("beforeunload", handleBeforeUnload);

        // Store cleanup functions
        cleanupFunctions.push(() => {
          document.removeEventListener(
            "visibilitychange",
            handleVisibilityChange
          );
          window.removeEventListener("beforeunload", handleBeforeUnload);
        });
      } else if (event === "SIGNED_OUT") {
        // Mark user as offline when signing out
        if (currentUserId) {
          await updatePresence(currentUserId, false);
        }

        // Clear heartbeat
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }

        currentUserId = null;
      }
    });

    // Cleanup on component unmount
    return () => {
      subscription.unsubscribe();
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      if (currentUserId) {
        updatePresence(currentUserId, false);
      }
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, []);

  return null; // This component doesn't render anything
}
