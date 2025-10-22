"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface RealtimeData {
  balances: {
    usd: number;
    euro: number;
    cad: number;
    crypto: number;
  };
  exchangeRates: {
    usd_to_eur: number;
    usd_to_cad: number;
    eur_to_usd: number;
    cad_to_usd: number;
  };
  cryptoPrices: {
    bitcoin: number;
    ethereum: number;
  };
  messages: any[];
  deposits: any[];
  cryptoTransactions: any[];
  loading: boolean;
  error: string | null;
}

export function useRealtimeData(): RealtimeData {
  const [data, setData] = useState<RealtimeData>({
    balances: { usd: 0, euro: 0, cad: 0, crypto: 0 },
    exchangeRates: {
      usd_to_eur: 0.85,
      usd_to_cad: 1.35,
      eur_to_usd: 1.18,
      cad_to_usd: 0.74,
    },
    cryptoPrices: { bitcoin: 45000, ethereum: 3000 },
    messages: [],
    deposits: [],
    cryptoTransactions: [],
    loading: true,
    error: null,
  });

  const fetchBalances = async (userId: string) => {
    try {
      const [usdResult, euroResult, cadResult, cryptoResult] =
        await Promise.all([
          supabase
            .from("usd_balances")
            .select("balance")
            .eq("user_id", userId)
            .single(),
          supabase
            .from("euro_balances")
            .select("balance")
            .eq("user_id", userId)
            .single(),
          supabase
            .from("cad_balances")
            .select("balance")
            .eq("user_id", userId)
            .single(),
          supabase
            .from("crypto_balances")
            .select("balance")
            .eq("user_id", userId)
            .single(),
        ]);

      return {
        usd: usdResult.data?.balance || 0,
        euro: euroResult.data?.balance || 0,
        cad: cadResult.data?.balance || 0,
        crypto: cryptoResult.data?.balance || 0,
      };
    } catch (error) {
      console.error("Error fetching balances:", error);
      return { usd: 0, euro: 0, cad: 0, crypto: 0 };
    }
  };

  const fetchExchangeRates = async () => {
    const baseRates = {
      usd_to_eur: 0.85,
      usd_to_cad: 1.35,
      eur_to_usd: 1.18,
      cad_to_usd: 0.74,
    };

    const variation = () => (Math.random() - 0.5) * 0.02;
    return {
      usd_to_eur: Math.max(0.01, baseRates.usd_to_eur + variation()),
      usd_to_cad: Math.max(0.01, baseRates.usd_to_cad + variation()),
      eur_to_usd: Math.max(0.01, baseRates.eur_to_usd + variation()),
      cad_to_usd: Math.max(0.01, baseRates.cad_to_usd + variation()),
    };
  };

  const fetchCryptoPrices = async () => {
    const basePrices = {
      bitcoin: 45000,
      ethereum: 3000,
    };

    const variation = () => (Math.random() - 0.5) * 0.1;
    return {
      bitcoin: Math.max(
        1000,
        Math.round(basePrices.bitcoin * (1 + variation()))
      ),
      ethereum: Math.max(
        100,
        Math.round(basePrices.ethereum * (1 + variation()))
      ),
    };
  };

  const fetchMessages = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching messages:", error.message || error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error("Error fetching messages:", error.message || error);
      return [];
    }
  };

  const fetchDeposits = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("deposits")
        .select("*")
        .eq("uuid", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching deposits:", error.message || error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error("Error fetching deposits:", error.message || error);
      return [];
    }
  };

  const fetchCryptoTransactions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("crypto_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error(
          "Error fetching crypto transactions:",
          error.message || error
        );
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error(
        "Error fetching crypto transactions:",
        error.message || error
      );
      return [];
    }
  };

  const initializeData = async () => {
    try {
      setData((prev) => ({ ...prev, loading: true, error: null }));
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setData((prev) => ({
          ...prev,
          loading: false,
          error: "User not authenticated",
        }));
        return;
      }

      const [
        balances,
        exchangeRates,
        cryptoPrices,
        messages,
        deposits,
        cryptoTransactions,
      ] = await Promise.all([
        fetchBalances(user.id),
        fetchExchangeRates(),
        fetchCryptoPrices(),
        fetchMessages(user.id),
        fetchDeposits(user.id),
        fetchCryptoTransactions(user.id),
      ]);

      setData({
        balances,
        exchangeRates,
        cryptoPrices,
        messages,
        deposits,
        cryptoTransactions,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      console.error("Error initializing data:", error);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: error.message || "Failed to load data",
      }));
    }
  };

  const setupRealtimeSubscriptions = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Subscribe to balance changes
    const balanceSubscription = supabase
      .channel("balance_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "usd_balances",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchBalances(user.id).then((balances) => {
            setData((prev) => ({ ...prev, balances }));
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "euro_balances",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchBalances(user.id).then((balances) => {
            setData((prev) => ({ ...prev, balances }));
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cad_balances",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchBalances(user.id).then((balances) => {
            setData((prev) => ({ ...prev, balances }));
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crypto_balances",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchBalances(user.id).then((balances) => {
            setData((prev) => ({ ...prev, balances }));
          });
        }
      )
      .subscribe();

    // Subscribe to message changes
    const messageSubscription = supabase
      .channel("message_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_messages",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchMessages(user.id).then((messages) => {
            setData((prev) => ({ ...prev, messages }));
          });
        }
      )
      .subscribe();

    // Subscribe to deposits changes
    const depositsSubscription = supabase
      .channel("deposits_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deposits",
          filter: `uuid=eq.${user.id}`,
        },
        () => {
          fetchDeposits(user.id).then((deposits) => {
            setData((prev) => ({ ...prev, deposits }));
          });
        }
      )
      .subscribe();

    // Subscribe to crypto transaction changes
    const cryptoTransactionSubscription = supabase
      .channel("crypto_transaction_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crypto_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchCryptoTransactions(user.id).then((cryptoTransactions) => {
            setData((prev) => ({ ...prev, cryptoTransactions }));
          });
          // Also refresh balances when crypto transaction status changes
          fetchBalances(user.id).then((balances) => {
            setData((prev) => ({ ...prev, balances }));
          });
        }
      )
      .subscribe();

    return () => {
      balanceSubscription.unsubscribe();
      messageSubscription.unsubscribe();
      depositsSubscription.unsubscribe();
      cryptoTransactionSubscription.unsubscribe();
    };
  };

  // Update exchange rates and crypto prices every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchExchangeRates().then((exchangeRates) => {
        setData((prev) => ({ ...prev, exchangeRates }));
      });
      fetchCryptoPrices().then((cryptoPrices) => {
        setData((prev) => ({ ...prev, cryptoPrices }));
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    initializeData();
    const cleanup = setupRealtimeSubscriptions();

    return () => {
      cleanup?.then((fn) => fn?.());
    };
  }, []);

  return data;
}
