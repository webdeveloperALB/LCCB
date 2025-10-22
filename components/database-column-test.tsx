"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

export default function DatabaseColumnTest() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testColumns = async () => {
    setLoading(true)
    try {
      // Test if we can insert location data
      const testData = {
        user_id: "test-user-id",
        is_online: true,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ip_address: "192.168.1.1",
        country: "Test Country",
        country_code: "TC",
        city: "Test City",
        region: "Test Region",
      }

      const { data, error } = await supabase.from("user_presence").upsert(testData, { onConflict: "user_id" }).select()

      if (error) {
        setResult({ error: error.message, details: error })
      } else {
        setResult({ success: true, data })

        // Clean up test data
        await supabase.from("user_presence").delete().eq("user_id", "test-user-id")
      }
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Unknown error" })
    }
    setLoading(false)
  }

  const checkTableStructure = async () => {
    setLoading(true)
    try {
      // Try to get table info using a simple query
      const { data, error } = await supabase.from("user_presence").select("*").limit(1)

      if (error) {
        setResult({ error: error.message })
      } else {
        // Get the first row to see what columns exist
        const columns = data && data.length > 0 ? Object.keys(data[0]) : []
        setResult({ columns, sampleData: data[0] })
      }
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Unknown error" })
    }
    setLoading(false)
  }

  return (
    <Card className="max-w-2xl mx-auto mb-6">
      <CardHeader>
        <CardTitle>Database Column Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Button onClick={testColumns} disabled={loading}>
            {loading ? "Testing..." : "Test Location Columns"}
          </Button>
          <Button onClick={checkTableStructure} disabled={loading} variant="outline">
            {loading ? "Checking..." : "Check Table Structure"}
          </Button>
        </div>

        {result && (
          <div className="space-y-2">
            <h3 className="font-semibold">Result:</h3>
            <pre className="p-4 bg-gray-100 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
