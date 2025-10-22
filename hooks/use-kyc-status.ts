"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Improved version with fixes for your issues
export function useKYCStatus(userId: string | null) {
  const [kycStatus, setKycStatus] = useState<
    "not_started" | "pending" | "approved" | "rejected" | "skipped" | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const checkKYCStatus = async () => {
      try {
        setError(null);

        // Check user's KYC status
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("kyc_status")
          .eq("id", userId)
          .single();

        if (userError) {
          // Handle specific error cases
          if (userError.code === "PGRST116") {
            // User not found - create user record
            console.log("User not found in users table, creating record...");

            const { error: insertError } = await supabase.from("users").insert({
              id: userId,
              kyc_status: "not_started",
              created_at: new Date().toISOString(),
            });

            if (insertError) {
              console.error("Error creating user record:", insertError);
              setError("Failed to create user record");
            }

            setKycStatus("not_started");
          } else {
            // Other database errors
            console.error("Database error:", userError);
            setError(`Database error: ${userError.message}`);
            setKycStatus("not_started");
          }
        } else {
          // Successfully got user data
          const status = userData?.kyc_status || "not_started";
          console.log("KYC status retrieved:", status);
          setKycStatus(status);
        }
      } catch (error: any) {
        console.error("Error checking KYC status:", error);
        setError(error.message);
        setKycStatus("not_started");
      } finally {
        setLoading(false);
      }
    };

    checkKYCStatus();

    // Set up real-time subscription for KYC status changes
    const subscription = supabase
      .channel(`kyc-status-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log("KYC status updated via subscription:", payload.new);
          setKycStatus(payload.new.kyc_status);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  // Refresh function for manual updates
  const refreshKYCStatus = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("kyc_status")
        .eq("id", userId)
        .single();

      if (!userError && userData) {
        setKycStatus(userData.kyc_status);
      }
    } catch (error) {
      console.error("Error refreshing KYC status:", error);
    } finally {
      setLoading(false);
    }
  };

  return { kycStatus, loading, error, refreshKYCStatus };
}
