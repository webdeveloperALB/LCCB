"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Download,
  MapPin,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Transaction {
  id: number;
  created_at: string;
  thType: string;
  thDetails: string;
  thPoi: string;
  thStatus: string;
  uuid: string;
  thEmail: string;
}

export default function ClientDepositsView() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // ✅ Get the currently logged-in user
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        setMessage({
          type: "error",
          text: "You must be logged in to view your transactions.",
        });
        setLoading(false);
        return;
      }

      setUserId(user?.id ?? null);
      setUserEmail(user?.email ?? null);
    };

    getUser();
  }, []);

  // ✅ Fetch transactions when we have the user's UUID
  useEffect(() => {
    if (userId) {
      fetchTransactions();

      // Real-time subscription for TransactionHistory
      const subscription = supabase
        .channel("client_transaction_history_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "TransactionHistory",
            filter: `uuid=eq.${userId}`,
          },
          (payload) => {
            console.log("Transaction update detected:", payload);
            fetchTransactions();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [userId]);

  // ✅ Fetch from TransactionHistory
  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("TransactionHistory")
        .select(
          `
          id,
          created_at,
          "thType",
          "thDetails",
          "thPoi",
          "thStatus",
          uuid,
          "thEmail"
        `
        )
        .eq("uuid", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setMessage({ type: "error", text: "Failed to load transactions." });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Utility: Icons & colors
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "successful":
      case "completed":
      case "approved":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "pending":
      case "processing":
      case "under review":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "failed":
      case "rejected":
      case "cancelled":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "successful":
      case "completed":
      case "approved":
        return "text-green-600 bg-green-50 border-green-200 hover:bg-green-100";
      case "pending":
      case "processing":
      case "under review":
        return "text-yellow-600 bg-yellow-50 border-yellow-200 hover:bg-yellow-100";
      case "failed":
      case "rejected":
      case "cancelled":
        return "text-red-600 bg-red-50 border-red-200 hover:bg-red-100";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "external deposit":
      case "deposit":
        return <Download className="w-4 h-4 text-blue-600" />;
      case "withdrawal":
        return <Building className="w-4 h-4 text-purple-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  // ✅ Loading State
  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        <div className="h-24 bg-gray-200 rounded"></div>
        <div className="h-48 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // ✅ Render
  return (
    <div className="flex-1 overflow-y-auto max-h-screen">
      <div className="p-4 pt-20 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <h2 className="text-xl sm:text-2xl font-bold">Transaction History</h2>
        </div>

        {message && (
          <Alert
            className={
              message.type === "error"
                ? "border-red-500 bg-red-50"
                : "border-green-500 bg-green-50"
            }
          >
            <AlertDescription
              className={`text-sm ${
                message.type === "error" ? "text-red-700" : "text-green-700"
              }`}
            >
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Transaction History */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-lg sm:text-xl">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Recent Activity
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium mb-2">
                  No transaction history
                </h3>
                <p className="text-sm">
                  Your transaction records will appear here once available.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="border rounded-lg p-4 space-y-4 hover:shadow-md transition"
                  >
                    <div className="flex flex-col sm:flex-row justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(tx.thType)}
                          <h3 className="font-bold text-lg sm:text-xl">
                            {tx.thType}
                          </h3>
                        </div>
                        <p className="text-gray-500 text-sm">
                          Processed:{" "}
                          {new Date(tx.created_at).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <Badge
                        className={`text-xs sm:text-sm w-fit ${getStatusColor(
                          tx.thStatus
                        )}`}
                      >
                        {getStatusIcon(tx.thStatus)}
                        <span className="ml-2">{tx.thStatus}</span>
                      </Badge>
                    </div>

                    <div className="bg-[#0A7F8D] border border-[#0A7F8D] rounded-lg p-3">
                      <h4 className="font-semibold text-white mb-2 flex items-center text-sm">
                        <FileText className="w-4 h-4 mr-2" />
                        Transaction Details
                      </h4>
                      <p className="text-white text-sm">{tx.thDetails}</p>

                      {tx.thPoi && (
                        <p className="text-white text-xs mt-2 flex items-center">
                          <MapPin className="w-3 h-3 mr-1" />
                          {tx.thPoi}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
