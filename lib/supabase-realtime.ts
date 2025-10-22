import { supabase } from "./supabase"

export const setupRealtimeSubscriptions = () => {
  // Set up real-time subscription for deposits
  const depositsSubscription = supabase
    .channel("deposits_changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "deposits",
      },
      (payload) => {
        console.log("Deposit change received:", payload)
      },
    )
    .subscribe()

  // Set up real-time subscription for transactions
  const transactionsSubscription = supabase
    .channel("transactions_changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "transactions",
      },
      (payload) => {
        console.log("Transaction change received:", payload)
      },
    )
    .subscribe()

  // Set up real-time subscription for profiles/balances
  const profilesSubscription = supabase
    .channel("profiles_changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "profiles",
      },
      (payload) => {
        console.log("Profile change received:", payload)
      },
    )
    .subscribe()

  return {
    unsubscribe: () => {
      depositsSubscription.unsubscribe()
      transactionsSubscription.unsubscribe()
      profilesSubscription.unsubscribe()
    },
  }
}

export const getRealtimeStatus = async () => {
  try {
    const { data } = await supabase.from("_realtime").select("*").limit(1)
    return { connected: true, data }
  } catch (error) {
    console.error("Realtime connection error:", error)
    return { connected: false, error }
  }
}
