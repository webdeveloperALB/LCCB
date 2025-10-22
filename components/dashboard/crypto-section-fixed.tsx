"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Wallet,
  Network,
  X,
  Coins,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

// ✅ Helper to format crypto numbers cleanly
function formatCryptoAmount(value: number, decimals = 8) {
  if (!value || isNaN(value)) return "0";
  if (value < 1) return value.toFixed(4).replace(/\.?0+$/, ""); // up to 4 decimals for small values
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 }); // up to 2 decimals for big values
}

interface UserProfile {
  id: string;
  client_id: string;
  full_name: string;
  email: string;
  created_at?: string;
  updated_at?: string;
}

interface CryptoSectionProps {
  userProfile: UserProfile;
}

interface CryptoTransaction {
  id: string;
  user_id: string;
  crypto_type: string;
  transaction_type: string;
  amount: number;
  price_per_unit: number;
  total_value: number;
  wallet_address: string;
  network: string;
  transaction_hash: string;
  gas_fee: number;
  status: string;
  created_at: string;
}

interface CryptoBalances {
  btc_balance: number;
  eth_balance: number;
  usdt_balance: number;
}

export default function RealCryptoTransferSection({
  userProfile,
}: CryptoSectionProps) {
  const [cryptoTransactions, setCryptoTransactions] = useState<
    CryptoTransaction[]
  >([]);
  const [cryptoBalances, setCryptoBalances] = useState<CryptoBalances>({
    btc_balance: 0,
    eth_balance: 0,
    usdt_balance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState<CryptoTransaction[]>(
    []
  );
  const [dismissedNotifications, setDismissedNotifications] = useState<
    string[]
  >([]);

  const [formData, setFormData] = useState({
    recipient_address: "",
    crypto_type: "",
    network: "",
    amount: "",
    gas_fee: "",
    label: "",
  });

  const cryptocurrencies = [
    {
      value: "BTC",
      label: "Bitcoin",
      symbol: "₿",
      iconUrl:
        "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg",
      color: "bg-orange-500",
      decimals: 8,
      networks: [
        { value: "bitcoin", label: "Bitcoin Network", fee: "0.0001" },
        { value: "lightning", label: "Lightning Network", fee: "0.000001" },
      ],
    },
    {
      value: "ETH",
      label: "Ethereum",
      symbol: "Ξ",
      iconUrl:
        "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",
      color: "bg-blue-500",
      decimals: 8,
      networks: [
        { value: "ethereum", label: "Ethereum Mainnet", fee: "0.002" },
        { value: "polygon", label: "Polygon (MATIC)", fee: "0.001" },
        { value: "arbitrum", label: "Arbitrum One", fee: "0.0005" },
        { value: "optimism", label: "Optimism", fee: "0.0005" },
      ],
    },
    {
      value: "USDT",
      label: "Tether USD",
      symbol: "$",
      iconUrl:
        "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdt.svg",
      color: "bg-green-500",
      decimals: 6,
      networks: [
        { value: "ethereum", label: "Ethereum (ERC-20)", fee: "0.002" },
        { value: "tron", label: "Tron (TRC-20)", fee: "1.0" },
        { value: "bsc", label: "BSC (BEP-20)", fee: "0.0005" },
        { value: "polygon", label: "Polygon (MATIC)", fee: "0.001" },
        { value: "avalanche", label: "Avalanche (AVAX)", fee: "0.001" },
      ],
    },
  ];

  useEffect(() => {
    if (userProfile?.id) {
      fetchCryptoTransactions();
      fetchCryptoBalances();
      setupRealtimeSubscription();
    }
  }, [userProfile?.id]);

  useEffect(() => {
    const pending = cryptoTransactions.filter(
      (tx) => tx.status.toLowerCase() === "pending"
    );
    setPendingTransfers(pending);
  }, [cryptoTransactions]);

  const fetchCryptoBalances = async () => {
    if (!userProfile?.id) return;

    try {
      console.log("Fetching crypto balances for user:", userProfile.id);
      console.log("User profile object:", userProfile);

      // Check if we can connect to Supabase
      const { data: testData, error: testError } = await supabase
        .from("newcrypto_balances")
        .select("count")
        .limit(1);

      console.log("Connection test:", { testData, testError });

      const { data, error } = await supabase
        .from("newcrypto_balances")
        .select("btc_balance, eth_balance, usdt_balance")
        .eq("user_id", userProfile.id)
        .single();

      console.log("Supabase query response:", { data, error });
      console.log(
        "Error details:",
        error?.message,
        error?.code,
        error?.details
      );

      if (error) {
        if (error.code === "PGRST116") {
          // No record found, create one
          console.log(
            "Creating new crypto balance record for user:",
            userProfile.id
          );
          const { error: insertError } = await supabase
            .from("newcrypto_balances")
            .insert({
              user_id: userProfile.id,
              btc_balance: 0,
              eth_balance: 0,
              usdt_balance: 0,
            });

          console.log("Insert result:", { insertError });

          if (!insertError) {
            setCryptoBalances({
              btc_balance: 0,
              eth_balance: 0,
              usdt_balance: 0,
            });
          }
        } else {
          console.error("Unexpected error code:", error.code, error);
        }
        return; // Don't throw, just return to avoid breaking the UI
      }

      setCryptoBalances({
        btc_balance: Number(data?.btc_balance) || 0,
        eth_balance: Number(data?.eth_balance) || 0,
        usdt_balance: Number(data?.usdt_balance) || 0,
      });

      console.log("Successfully set crypto balances:", {
        btc_balance: Number(data?.btc_balance) || 0,
        eth_balance: Number(data?.eth_balance) || 0,
        usdt_balance: Number(data?.usdt_balance) || 0,
      });
    } catch (error) {
      console.error("Error fetching crypto balances:", error);
      console.error("Error type:", typeof error);
      console.error("Error constructor:", error?.constructor?.name);
      console.error("User ID:", userProfile?.id);
      console.error("Full error object:", JSON.stringify(error, null, 2));
    }
  };

  const fetchCryptoTransactions = async () => {
    if (!userProfile?.id) return;

    try {
      const { data, error } = await supabase
        .from("crypto_transactions")
        .select("*")
        .eq("user_id", userProfile.id)
        .eq("transaction_type", "Transfer")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCryptoTransactions(data || []);
    } catch (error) {
      console.error("Error fetching crypto transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = async () => {
    if (!userProfile?.id) return;

    const transactionSubscription = supabase
      .channel("crypto_transaction_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crypto_transactions",
          filter: `user_id=eq.${userProfile.id}`,
        },
        (payload) => {
          console.log("Transaction status changed:", payload);
          fetchCryptoTransactions();
          if (
            payload.eventType === "UPDATE" &&
            payload.new.status === "Completed"
          ) {
            setDismissedNotifications((prev) =>
              prev.filter((id) => id !== payload.new.id)
            );
          }
        }
      )
      .subscribe();

    const balanceSubscription = supabase
      .channel("crypto_balance_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "newcrypto_balances",
          filter: `user_id=eq.${userProfile.id}`,
        },
        () => {
          fetchCryptoBalances();
        }
      )
      .subscribe();

    return () => {
      transactionSubscription.unsubscribe();
      balanceSubscription.unsubscribe();
    };
  };

  const handleCryptoTypeChange = (cryptoType: string) => {
    const selectedCrypto = cryptocurrencies.find((c) => c.value === cryptoType);
    setFormData({
      ...formData,
      crypto_type: cryptoType,
      network: "",
      gas_fee: "",
    });
  };

  const handleNetworkChange = (network: string) => {
    const selectedCrypto = cryptocurrencies.find(
      (c) => c.value === formData.crypto_type
    );
    const selectedNetwork = selectedCrypto?.networks.find(
      (n) => n.value === network
    );
    setFormData({
      ...formData,
      network: network,
      gas_fee: selectedNetwork?.fee || "",
    });
  };

  const submitTransfer = async () => {
    if (!userProfile?.id) return;

    try {
      setSubmitting(true);

      const amount = Number.parseFloat(formData.amount);
      const gasFee = Number.parseFloat(formData.gas_fee);
      const totalAmount = amount + gasFee;

      // Get current balance for the selected crypto
      const currentBalance =
        cryptoBalances[
          `${formData.crypto_type.toLowerCase()}_balance` as keyof CryptoBalances
        ];

      if (totalAmount > currentBalance) {
        alert(`Insufficient ${formData.crypto_type} balance for this transfer`);
        return;
      }

      // Use the database function to process transfer
      const { data, error } = await supabase.rpc(
        "process_real_crypto_transfer",
        {
          p_user_id: userProfile.id,
          p_crypto_type: formData.crypto_type,
          p_network: formData.network,
          p_amount: amount,
          p_gas_fee: gasFee,
          p_total_amount: totalAmount,
          p_wallet_address: formData.recipient_address,
          p_current_balance: currentBalance,
        }
      );

      if (error) {
        console.error("Transfer processing error:", error);
        alert(`Error processing transfer: ${error.message}`);
        return;
      }

      // Update local balance
      setCryptoBalances((prev) => ({
        ...prev,
        [`${formData.crypto_type.toLowerCase()}_balance`]:
          currentBalance - totalAmount,
      }));

      // Add to general transactions for tracking
      await supabase.from("transactions").insert({
        user_id: userProfile.id,
        transaction_type: "Crypto Transfer",
        amount: totalAmount,
        currency: formData.crypto_type,
        description: `Transfer ${amount} ${
          formData.crypto_type
        } to ${formData.recipient_address.substring(0, 10)}...${
          formData.label ? ` - ${formData.label}` : ""
        }`,
        platform: `${formData.crypto_type} Network`,
        status: "Pending",
      });

      // Reset form and show success message
      setFormData({
        recipient_address: "",
        crypto_type: "",
        network: "",
        amount: "",
        gas_fee: "",
        label: "",
      });
      setShowTransferForm(false);
      setShowSuccessMessage(true);

      // Refresh data
      fetchCryptoTransactions();
      fetchCryptoBalances();

      setTimeout(() => setShowSuccessMessage(false), 5000);
    } catch (error: any) {
      console.error("Submit transfer error:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const dismissNotification = (transactionId: string) => {
    setDismissedNotifications((prev) => [...prev, transactionId]);
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "completed":
        return "text-green-600 bg-green-50 border-green-200";
      case "failed":
      case "rejected":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const selectedCrypto = cryptocurrencies.find(
    (c) => c.value === formData.crypto_type
  );
  const selectedNetwork = selectedCrypto?.networks.find(
    (n) => n.value === formData.network
  );

  const amount = Number.parseFloat(formData.amount) || 0;
  const gasFee = Number.parseFloat(formData.gas_fee) || 0;
  const totalAmount = amount + gasFee;

  const currentBalance = formData.crypto_type
    ? cryptoBalances[
        `${formData.crypto_type.toLowerCase()}_balance` as keyof CryptoBalances
      ]
    : 0;

  const activeNotifications = cryptoTransactions.filter(
    (tx) =>
      !dismissedNotifications.includes(tx.id) &&
      (tx.status.toLowerCase() === "pending" ||
        tx.status.toLowerCase() === "completed")
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A7F8D] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading cryptocurrency data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 pt-4 pt-xs-16 space-y-6 relative min-h-full">
        {/* Floating Notifications */}
        {(showSuccessMessage || activeNotifications.length > 0) && (
          <div className="fixed inset-0 pointer-events-none z-50">
            <div className="absolute top-4 right-4 space-y-2 max-w-sm">
              {showSuccessMessage && (
                <div className="animate-in slide-in-from-right duration-300 pointer-events-auto">
                  <Alert className="border-green-200 bg-green-50 shadow-lg">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Transfer Request Submitted!</strong>
                      <br />
                      Your cryptocurrency transfer request has been received and
                      is under review.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {activeNotifications.length > 0 &&
                activeNotifications.slice(0, 3).map((transaction) => (
                  <div
                    key={transaction.id}
                    className={`p-4 rounded-lg shadow-lg border animate-in slide-in-from-right duration-300 pointer-events-auto ${
                      transaction.status.toLowerCase() === "pending"
                        ? "bg-yellow-50 border-yellow-200"
                        : "bg-green-50 border-green-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <div className="mt-0.5">
                          {transaction.status.toLowerCase() === "pending" ? (
                            <Clock className="w-4 h-4 text-yellow-600" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              transaction.status.toLowerCase() === "pending"
                                ? "text-yellow-800"
                                : "text-green-800"
                            }`}
                          >
                            {transaction.status.toLowerCase() === "pending"
                              ? "Transfer Under Review"
                              : "Transfer Completed"}
                          </p>
                          <p
                            className={`text-xs ${
                              transaction.status.toLowerCase() === "pending"
                                ? "text-yellow-700"
                                : "text-green-700"
                            }`}
                          >
                            {Number(transaction.amount).toFixed(
                              cryptocurrencies.find(
                                (c) => c.value === transaction.crypto_type
                              )?.decimals || 8
                            )}{" "}
                            {transaction.crypto_type} to{" "}
                            {transaction.wallet_address?.substring(0, 8)}...
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dismissNotification(transaction.id)}
                        className="h-6 w-6 p-0 hover:bg-transparent"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Header Section with Crypto Balances */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold text-gray-900">
                Cryptocurrency
              </h2>
              <p className="text-gray-600">
                Manage your Bitcoin, Ethereum, and USDT
              </p>
            </div>
            <Button
              onClick={() => setShowTransferForm(true)}
              className="bg-[#0A7F8D] hover:bg-[#0A7F8D]/90 text-white px-6 py-2 h-auto"
              disabled={
                cryptoBalances.btc_balance +
                  cryptoBalances.eth_balance +
                  cryptoBalances.usdt_balance <=
                0
              }
            >
              <Send className="w-4 h-4 mr-2" />
              New Transfer
            </Button>
          </div>

          {/* Crypto Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cryptocurrencies.map((crypto) => {
              const balance =
                cryptoBalances[
                  `${crypto.value.toLowerCase()}_balance` as keyof CryptoBalances
                ];

              return (
                <Card key={crypto.value} className="relative overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center p-1`}
                          >
                            <img
                              src={crypto.iconUrl || "/placeholder.svg"}
                              alt={crypto.label}
                              className="w-10 h-10"
                            />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {crypto.label}
                            </p>
                            <p className="text-sm text-gray-500">
                              {crypto.value}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatCryptoAmount(balance, crypto.decimals)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {crypto.symbol} {crypto.value}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Transfer Form */}
        {showTransferForm && (
          <Card className="animate-in slide-in-from-top duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Send className="w-6 h-6 text-[#0A7F8D]" />
                New Cryptocurrency Transfer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Cryptocurrency Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  Cryptocurrency *
                </Label>
                <Select
                  value={formData.crypto_type}
                  onValueChange={handleCryptoTypeChange}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select cryptocurrency" />
                  </SelectTrigger>
                  <SelectContent>
                    {cryptocurrencies.map((crypto) => {
                      const balance =
                        cryptoBalances[
                          `${crypto.value.toLowerCase()}_balance` as keyof CryptoBalances
                        ];

                      return (
                        <SelectItem key={crypto.value} value={crypto.value}>
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center p-1`}
                            >
                              <img
                                src={crypto.iconUrl || "/placeholder.svg"}
                                alt={crypto.label}
                                className="w-8 h-8"
                              />
                            </div>
                            <div className="flex-1">
                              <span className="font-medium">
                                {crypto.label}
                              </span>
                              <span className="text-gray-500 ml-2">
                                ({crypto.value})
                              </span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {formatCryptoAmount(balance, crypto.decimals)}
                            </Badge>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Network Selection */}
              {selectedCrypto && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Network className="w-4 h-4" />
                    Network *
                  </Label>
                  <Select
                    value={formData.network}
                    onValueChange={handleNetworkChange}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCrypto.networks.map((network) => (
                        <SelectItem key={network.value} value={network.value}>
                          <div className="flex items-center justify-between w-full">
                            <span>{network.label}</span>
                            <span className="text-gray-500 text-sm ml-4">
                              Fee: ~{network.fee} {selectedCrypto.value}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Recipient Address */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Recipient Address *
                </Label>
                <Input
                  value={formData.recipient_address}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recipient_address: e.target.value,
                    })
                  }
                  placeholder="Enter wallet address (e.g., 0x1234...abcd or bc1q...)"
                  className="font-mono text-sm h-12"
                />
              </div>

              {/* Amount and Gas Fee */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Amount *</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step={
                        selectedCrypto
                          ? `0.${"0".repeat(selectedCrypto.decimals - 1)}1`
                          : "0.00000001"
                      }
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                      placeholder={
                        selectedCrypto
                          ? `0.${"0".repeat(selectedCrypto.decimals)}`
                          : "0.00000000"
                      }
                      className="h-12 pr-16"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      {formData.crypto_type || "CRYPTO"}
                    </div>
                  </div>

                  {formData.crypto_type && (
                    <p className="text-xs text-gray-500">
                      Available:{" "}
                      <span className="font-medium">
                        {formatCryptoAmount(
                          currentBalance,
                          selectedCrypto?.decimals || 8
                        )}
                      </span>{" "}
                      {formData.crypto_type}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Network Fee (Gas) *
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step={
                        selectedCrypto
                          ? `0.${"0".repeat(selectedCrypto.decimals - 1)}1`
                          : "0.00000001"
                      }
                      value={formData.gas_fee}
                      onChange={(e) =>
                        setFormData({ ...formData, gas_fee: e.target.value })
                      }
                      placeholder={
                        selectedCrypto
                          ? `0.${"0".repeat(selectedCrypto.decimals)}`
                          : "0.00000000"
                      }
                      className="h-12 pr-16"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      {formData.crypto_type || "CRYPTO"}
                    </div>
                  </div>

                  {selectedNetwork && (
                    <p className="text-xs text-gray-500">
                      Suggested:{" "}
                      <span className="font-medium">
                        {formatCryptoAmount(
                          Number(selectedNetwork.fee),
                          selectedCrypto?.decimals || 8
                        )}
                      </span>{" "}
                      {formData.crypto_type}
                    </p>
                  )}
                </div>
              </div>

              {/* Label/Note */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Label / Note (Optional)
                </Label>
                <Textarea
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                  placeholder="Add a note for this transfer..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Transfer Summary */}
              {amount > 0 && gasFee > 0 && selectedCrypto && (
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    Transfer Summary
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Transfer Amount:
                      </span>
                      <span className="font-medium">
                        {formatCryptoAmount(amount, selectedCrypto.decimals)}{" "}
                        {formData.crypto_type}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Network Fee:
                      </span>
                      <span className="font-medium">
                        {formatCryptoAmount(gasFee, selectedCrypto.decimals)}{" "}
                        {formData.crypto_type}
                      </span>
                    </div>
                    {selectedNetwork && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Network:</span>
                        <span className="font-medium">
                          {selectedNetwork.label}
                        </span>
                      </div>
                    )}
                    <hr className="my-2" />
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">
                        Total Amount:
                      </span>
                      <span className="text-lg font-bold text-[#0A7F8D]">
                        {formatCryptoAmount(
                          totalAmount,
                          selectedCrypto.decimals
                        )}{" "}
                        {formData.crypto_type}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Insufficient Balance Warning */}
              {totalAmount > currentBalance && totalAmount > 0 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    Insufficient balance. You need{" "}
                    {formatCryptoAmount(
                      totalAmount,
                      selectedCrypto?.decimals || 8
                    )}{" "}
                    {formData.crypto_type} but only have{" "}
                    {formatCryptoAmount(
                      currentBalance,
                      selectedCrypto?.decimals || 8
                    )}{" "}
                    {formData.crypto_type} available.
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={submitTransfer}
                  className="bg-[#0A7F8D] hover:bg-[#0A7F8D]/90 text-white h-12 px-8"
                  disabled={
                    !formData.recipient_address ||
                    !formData.crypto_type ||
                    !formData.network ||
                    !formData.amount ||
                    !formData.gas_fee ||
                    submitting ||
                    totalAmount > currentBalance
                  }
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Transfer
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowTransferForm(false)}
                  disabled={submitting}
                  className="h-12 px-6"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Transfer History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">
              Transfer History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cryptoTransactions.length === 0 ? (
              <div className="text-center py-12">
                <Send className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  No cryptocurrency transfers yet
                </p>
                <p className="text-gray-400 text-sm">
                  Your transfer history will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cryptoTransactions.map((transaction) => {
                  const crypto = cryptocurrencies.find(
                    (c) => c.value === transaction.crypto_type
                  );

                  return (
                    <div
                      key={transaction.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(transaction.status)}
                          <p className="font-medium text-gray-900">
                            {transaction.crypto_type} Transfer to{" "}
                            {transaction.wallet_address?.substring(0, 10)}...
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          <span>Network: {transaction.network}</span>
                          <span>
                            Amount:{" "}
                            <span className="font-medium text-gray-800">
                              {formatCryptoAmount(
                                Number(transaction.amount),
                                crypto?.decimals || 8
                              )}
                            </span>{" "}
                            {transaction.crypto_type}
                          </span>
                          <span>
                            Fee:{" "}
                            <span className="font-medium text-gray-800">
                              {formatCryptoAmount(
                                Number(transaction.gas_fee),
                                crypto?.decimals || 8
                              )}
                            </span>{" "}
                            {transaction.crypto_type}
                          </span>
                        </div>

                        {transaction.transaction_hash && (
                          <p className="text-xs text-gray-500 font-mono">
                            Hash:{" "}
                            {transaction.transaction_hash.substring(0, 20)}...
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          {new Date(transaction.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 mt-3 sm:mt-0">
                        <div className="text-right">
                          <p className="font-medium text-gray-900">
                            -{" "}
                            {formatCryptoAmount(
                              Number(transaction.total_value),
                              crypto?.decimals || 8
                            )}{" "}
                            {transaction.crypto_type}
                          </p>
                        </div>
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            transaction.status
                          )}`}
                        >
                          {transaction.status}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
