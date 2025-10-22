// components/debug/SupabaseDebugHelper.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SupabaseDebugHelper() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (test: string, result: any, error: any = null) => {
    setResults(prev => [...prev, {
      test,
      success: !error,
      result,
      error,
      timestamp: new Date().toISOString()
    }]);
  };

  const runDiagnostics = async () => {
    setLoading(true);
    setResults([]);

    // Test 1: Check authentication
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      addResult("Authentication", { user: user?.id, email: user?.email }, error);
    } catch (error) {
      addResult("Authentication", null, error);
    }

    // Test 2: Check profiles table access
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("count", { count: "exact" })
        .limit(0);
      addResult("Profiles table access", { count: data }, error);
    } catch (error) {
      addResult("Profiles table access", null, error);
    }

    // Test 3: Check if current user profile exists
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        addResult("Current user profile", data, error);
      }
    } catch (error) {
      addResult("Current user profile", null, error);
    }

    // Test 4: Check balance tables
    const balanceTables = ["crypto_balances", "euro_balances", "cad_balances", "usd_balances"];
    for (const table of balanceTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("count", { count: "exact" })
          .limit(0);
        addResult(`${table} access`, { count: data }, error);
      } catch (error) {
        addResult(`${table} access`, null, error);
      }
    }

    // Test 5: Check user_messages table (the one causing 406 error)
    try {
      const { data, error } = await supabase
        .from("user_messages")
        .select("count", { count: "exact" })
        .limit(0);
      addResult("user_messages table access", { count: data }, error);
    } catch (error) {
      addResult("user_messages table access", null, error);
    }

    // Test 6: Test the specific failing query
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("user_messages")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(1);
        addResult("Failing user_messages query", data, error);
      }
    } catch (error) {
      addResult("Failing user_messages query", null, error);
    }

    // Test 7: Check RLS policies
    try {
      const { data, error } = await supabase.rpc('get_policies_for_table', { 
        table_name: 'profiles' 
      });
      addResult("RLS policies check", data, error);
    } catch (error) {
      addResult("RLS policies check", "RPC not available or no permissions", error);
    }

    setLoading(false);
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Supabase Debug Helper</h2>
      
      <div className="mb-4 space-x-2">
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "Running Diagnostics..." : "Run Diagnostics"}
        </button>
        <button
          onClick={clearResults}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Clear Results
        </button>
      </div>

      <div className="space-y-4">
        {results.map((result, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${
              result.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">
                {result.success ? '✅' : '❌'} {result.test}
              </h3>
              <span className="text-xs text-gray-500">{result.timestamp}</span>
            </div>
            
            {result.result && (
              <div className="mb-2">
                <strong>Result:</strong>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(result.result, null, 2)}
                </pre>
              </div>
            )}
            
            {result.error && (
              <div>
                <strong className="text-red-600">Error:</strong>
                <pre className="bg-red-100 p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(result.error, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {results.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          Click "Run Diagnostics" to test your Supabase setup
        </div>
      )}
    </div>
  );
}