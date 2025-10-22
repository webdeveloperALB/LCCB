// Real-time data utilities for the crypto banking system
import { supabase } from "@/lib/supabase";

export interface RealtimeDataConfig {
  userId: string;
  onBalanceUpdate?: (data: any) => void;
  onTransactionUpdate?: (data: any) => void;
  onActivityUpdate?: (data: any) => void;
  onMessageUpdate?: (data: any) => void;
}

export class RealtimeDataManager {
  private subscriptions: any[] = [];
  private config: RealtimeDataConfig;

  constructor(config: RealtimeDataConfig) {
    this.config = config;
  }

  async initialize() {
    // Subscribe to balance changes
    const balanceSubscription = supabase
      .channel("balance_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "balances",
          filter: `user_id=eq.${this.config.userId}`,
        },
        (payload) => {
          this.config.onBalanceUpdate?.(payload);
        }
      )
      .subscribe();

    // Subscribe to crypto balance changes
    const cryptoBalanceSubscription = supabase
      .channel("crypto_balance_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "newcrypto_balances",
          filter: `user_id=eq.${this.config.userId}`,
        },
        (payload) => {
          this.config.onBalanceUpdate?.(payload);
        }
      )
      .subscribe();

    // Subscribe to transaction changes
    const transactionSubscription = supabase
      .channel("transaction_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${this.config.userId}`,
        },
        (payload) => {
          this.config.onTransactionUpdate?.(payload);
        }
      )
      .subscribe();

    // Subscribe to crypto transaction changes
    const cryptoTransactionSubscription = supabase
      .channel("crypto_transaction_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crypto_transactions",
          filter: `user_id=eq.${this.config.userId}`,
        },
        (payload) => {
          this.config.onTransactionUpdate?.(payload);
        }
      )
      .subscribe();

    // Subscribe to account activity changes
    const activitySubscription = supabase
      .channel("activity_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "account_activities",
          filter: `user_id=eq.${this.config.userId}`,
        },
        (payload) => {
          this.config.onActivityUpdate?.(payload);
        }
      )
      .subscribe();

    this.subscriptions = [
      balanceSubscription,
      cryptoBalanceSubscription,
      transactionSubscription,
      cryptoTransactionSubscription,
      activitySubscription,
    ];
  }

  cleanup() {
    this.subscriptions.forEach((subscription) => {
      supabase.removeChannel(subscription);
    });
    this.subscriptions = [];
  }
}

// Utility functions for real-time data
export const createRealtimeSubscription = (
  table: string,
  userId: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`${table}_updates`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();
};

export const subscribeToUserData = (
  userId: string,
  callbacks: {
    onBalance?: (data: any) => void;
    onTransaction?: (data: any) => void;
    onActivity?: (data: any) => void;
  }
) => {
  const subscriptions = [];

  if (callbacks.onBalance) {
    subscriptions.push(
      createRealtimeSubscription("balances", userId, callbacks.onBalance)
    );
    subscriptions.push(
      createRealtimeSubscription(
        "newcrypto_balances",
        userId,
        callbacks.onBalance
      )
    );
  }

  if (callbacks.onTransaction) {
    subscriptions.push(
      createRealtimeSubscription(
        "transactions",
        userId,
        callbacks.onTransaction
      )
    );
    subscriptions.push(
      createRealtimeSubscription(
        "crypto_transactions",
        userId,
        callbacks.onTransaction
      )
    );
  }

  if (callbacks.onActivity) {
    subscriptions.push(
      createRealtimeSubscription(
        "account_activities",
        userId,
        callbacks.onActivity
      )
    );
  }

  return subscriptions;
};
