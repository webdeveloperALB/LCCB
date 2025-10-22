"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function FixUsers() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const fixExistingUsers = async () => {
    setLoading(true)
    setMessage("Checking and fixing users...")

    try {
      // Get all users from auth.users
      const {
        data: { users },
        error: usersError,
      } = await supabase.auth.admin.listUsers()

      if (usersError) throw usersError

      let fixedCount = 0

      for (const user of users) {
        // Check if profile exists
        const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).single()

        if (!profile) {
          // Create missing profile
          const clientId = Math.floor(Math.random() * 1000000)
            .toString()
            .padStart(6, "0")

          await supabase.from("profiles").insert({
            id: user.id,
            client_id: clientId,
            full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
            email: user.email,
          })

          // Create missing balance records
          await Promise.all([
            supabase.from("crypto_balances").upsert({ user_id: user.id, balance: 0 }),
            supabase.from("euro_balances").upsert({ user_id: user.id, balance: 0 }),
            supabase.from("cad_balances").upsert({ user_id: user.id, balance: 0 }),
            supabase.from("usd_balances").upsert({ user_id: user.id, balance: 0 }),
          ])

          fixedCount++
        }
      }

      setMessage(`Fixed ${fixedCount} users. Total users: ${users.length}`)
    } catch (error: any) {
      setMessage(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>Fix Existing Users (Admin)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          This will check all existing users and create missing profiles and balance records.
        </p>

        <Button onClick={fixExistingUsers} disabled={loading} className="w-full bg-[#F26623] hover:bg-[#E55A1F]">
          {loading ? "Fixing Users..." : "Fix Existing Users"}
        </Button>

        {message && (
          <p className={`text-sm ${message.includes("Error") ? "text-red-600" : "text-green-600"}`}>{message}</p>
        )}
      </CardContent>
    </Card>
  )
}
