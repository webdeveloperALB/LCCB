"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react"

export default function DatabaseCheck() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const checkTables = async () => {
    setLoading(true)
    const checks = []

    // Check each table
    const tables = [
      "profiles",
      "user_messages",
      "crypto_balances",
      "euro_balances",
      "cad_balances",
      "usd_balances",
      "transactions",
      "currencies",
      "cryptocurrencies",
    ]

    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select("*").limit(1)

        checks.push({
          table,
          status: error ? "ERROR" : "OK",
          message: error ? error.message : `Table accessible (${data?.length || 0} records found)`,
          error: error,
        })
      } catch (err: any) {
        checks.push({
          table,
          status: "ERROR",
          message: err.message,
          error: err,
        })
      }
    }

    setResults(checks)
    setLoading(false)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "OK":
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case "ERROR":
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Database Table Check</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={checkTables} disabled={loading} className="w-full bg-[#F26623] hover:bg-[#E55A1F]">
          {loading ? "Checking Tables..." : "Check Database Tables"}
        </Button>

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded border-l-4 ${
                  result.status === "OK" ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getStatusIcon(result.status)}
                    <span className="font-medium ml-2">{result.table}</span>
                  </div>
                  <span className={`text-sm font-bold ${result.status === "OK" ? "text-green-600" : "text-red-600"}`}>
                    {result.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{result.message}</p>
              </div>
            ))}
          </div>
        )}

        {results.some((r) => r.status === "ERROR") && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <h4 className="font-medium text-red-800 mb-2">⚠️ Database Issues Found</h4>
            <p className="text-sm text-red-700">
              Some tables are missing or inaccessible. Please run the database setup script:
            </p>
            <code className="block mt-2 p-2 bg-red-100 rounded text-xs">
              scripts/complete-system-fix-with-auto-messages.sql
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
