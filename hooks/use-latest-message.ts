"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface LatestMessage {
  id: string;
  title: string;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
  user_id: string;
}

export function useLatestMessage() {
  const [latestMessage, setLatestMessage] = useState<LatestMessage | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLatestMessage = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_messages")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching latest message:", error.message || error);
        setError(error.message || "Failed to fetch message");
      } else {
        setLatestMessage(data || null);
      }
    } catch (err: any) {
      console.error("Error in fetchLatestMessage:", err.message || err);
      setError(err.message || "Failed to fetch message");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("user_messages")
        .update({ is_read: true })
        .eq("id", messageId);

      if (error) {
        console.error("Error marking message as read:", error.message || error);
        throw error;
      }

      setLatestMessage(null);
    } catch (err: any) {
      console.error("Error in markAsRead:", err.message || err);
      throw err;
    }
  };

  useEffect(() => {
    fetchLatestMessage();

    // Set up real-time subscription for new messages
    const setupSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const subscription = supabase
        .channel("latest_message_changes")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "user_messages",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchLatestMessage();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    };

    const cleanup = setupSubscription();

    return () => {
      cleanup?.then((fn) => fn?.());
    };
  }, []);

  return {
    latestMessage,
    loading,
    error,
    markAsRead,
    refetch: fetchLatestMessage,
  };
}
