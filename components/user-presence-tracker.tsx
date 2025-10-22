"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useEnhancedPresenceTracker } from "@/hooks/use-user-presence";

export default function EnhancedPresenceProvider() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { updatePresence, markOffline } = useEnhancedPresenceTracker({
    userId: user?.id || "",
    enabled: !!user && !loading,
    heartbeatInterval: 30000,
  });

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        if (user?.id) {
          await markOffline();
        }
      }

      if (event === "TOKEN_REFRESHED") {
        return;
      }

      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user, markOffline]);

  useEffect(() => {
    return () => {
      if (user?.id) {
        markOffline();
      }
    };
  }, [user?.id, markOffline]);

  return null;
}
