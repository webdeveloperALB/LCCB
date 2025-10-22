"use client"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

export default function DatabaseDebug() {
  const [presenceData, setPresenceData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const checkDatabase = async () => {
    setLoading(true)
    try {
      // Check table structure
      const { data: columns } = await supabase.rpc("get_table_columns", { table_name: "user_presence" }).single()

      // Get all presence data
      const { data: allPresence, error } = await supabase
        .from("user_presence")
        .select("*")
        .order("updated_at", { ascending: false })

      if (error) {
        console.error("Database error:", error)
      } else {
        setPresenceData(allPresence || [])
      }
    } catch (error) {
      console.error("Check failed:", error)
    }
    setLoading(false)
  }

  useEffect(() => {
    checkDatabase()
  }, [])

  return (
    <Card className="max-w-4xl mx-auto mb-6">
      <CardHeader>
        <CardTitle>Database Debug</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={checkDatabase} disabled={loading} className="mb-4">
          {loading ? "Checking..." : "Refresh Database Data"}
        </Button>

        <div className="space-y-4">
          <h3 className="font-semibold">Current Presence Data:</h3>
          {presenceData.map((presence, index) => (
            <div key={index} className="p-3 border rounded">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <strong>User ID:</strong> {presence.user_id}
                </div>
                <div>
                  <strong>Online:</strong> {presence.is_online ? "Yes" : "No"}
                </div>
                <div>
                  <strong>IP:</strong> {presence.ip_address || "Not set"}
                </div>
                <div>
                  <strong>Country:</strong> {presence.country || "Not set"}
                </div>
                <div>
                  <strong>City:</strong> {presence.city || "Not set"}
                </div>
                <div>
                  <strong>Last Seen:</strong> {presence.last_seen}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
