"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowUpRight,
  DollarSign,
  Euro,
  Banknote,
  RefreshCw,
  Clock,
} from "lucide-react";

export default function TransfersSection() {
  const [balances, setBalances] = useState({
    usd: 0,
    euro: 0,
    cad: 0,
  });
  const [exchangeRates, setExchangeRates] = useState({
    usd_to_eur: 0.85,
    usd_to_cad: 1.35,
    eur_to_usd: 1.18,
    cad_to_usd: 0.74,
    eur_to_cad: 1.58,
    cad_to_eur: 0.63,
  });
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("EUR");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    fetchBalances();
    fetchTransactions();
    startRateUpdates();
  }, []);

  const fetchBalances = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [usdRes, euroRes, cadRes] = await Promise.all([
        supabase
          .from("usd_balances")
          .select("balance")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("euro_balances")
          .select("balance")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("cad_balances")
          .select("balance")
          .eq("user_id", user.id)
          .single(),
      ]);

      setBalances({
        usd: usdRes.data?.balance || 0,
        euro: euroRes.data?.balance || 0,
        cad: cadRes.data?.balance || 0,
      });
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("transaction_type", "currency_exchange")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  const startRateUpdates = () => {
    const updateRates = () => {
      setExchangeRates((prev) => ({
        usd_to_eur: Math.max(
          0.7,
          prev.usd_to_eur + (Math.random() - 0.5) * 0.001
        ),
        usd_to_cad: Math.max(
          1.0,
          prev.usd_to_cad + (Math.random() - 0.5) * 0.001
        ),
        eur_to_usd: Math.max(
          1.0,
          prev.eur_to_usd + (Math.random() - 0.5) * 0.001
        ),
        cad_to_usd: Math.max(
          0.6,
          prev.cad_to_usd + (Math.random() - 0.5) * 0.001
        ),
        eur_to_cad: Math.max(
          1.3,
          prev.eur_to_cad + (Math.random() - 0.5) * 0.001
        ),
        cad_to_eur: Math.max(
          0.5,
          prev.cad_to_eur + (Math.random() - 0.5) * 0.001
        ),
      }));
    };

    const interval = setInterval(updateRates, 5000);
    return () => clearInterval(interval);
  };

  const getCurrencyRate = (from: string, to: string) => {
    const key =
      `${from.toLowerCase()}_to_${to.toLowerCase()}` as keyof typeof exchangeRates;
    return exchangeRates[key] || 1;
  };

  const getConvertedAmount = () => {
    if (!amount || fromCurrency === toCurrency) return 0;
    const rate = getCurrencyRate(fromCurrency, toCurrency);
    return Number.parseFloat(amount) * rate;
  };

  const handleTransfer = async () => {
    if (!amount || Number.parseFloat(amount) <= 0) {
      setMessage("Please enter a valid amount");
      return;
    }

    if (fromCurrency === toCurrency) {
      setMessage("Please select different currencies");
      return;
    }

    const transferAmount = Number.parseFloat(amount);
    const fromBalance =
      balances[fromCurrency.toLowerCase() as keyof typeof balances];

    if (transferAmount > fromBalance) {
      setMessage(`Insufficient ${fromCurrency} balance`);
      return;
    }

    const convertedAmount = getConvertedAmount();

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("User not authenticated");

      const fromTable = `${fromCurrency.toLowerCase()}_balances`;
      const toTable = `${toCurrency.toLowerCase()}_balances`;

      // Update balances
      await Promise.all([
        supabase.from(fromTable).upsert({
          user_id: user.id,
          balance: fromBalance - transferAmount,
        }),
        supabase.from(toTable).upsert({
          user_id: user.id,
          balance:
            balances[toCurrency.toLowerCase() as keyof typeof balances] +
            convertedAmount,
        }),
      ]);

      // Record transaction
      await supabase.from("transactions").insert({
        user_id: user.id,
        transaction_type: "currency_exchange",
        amount: transferAmount,
        currency: fromCurrency,
        status: "completed",
        description: `Exchanged ${transferAmount} ${fromCurrency} to ${convertedAmount.toFixed(
          2
        )} ${toCurrency}`,
      });

      setMessage(
        `Successfully exchanged ${transferAmount} ${fromCurrency} to ${convertedAmount.toFixed(
          2
        )} ${toCurrency}`
      );
      setAmount("");
      fetchBalances();
      fetchTransactions();
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getCurrencyIcon = (currency: string) => {
    switch (currency) {
      case "USD":
        return <DollarSign className="h-5 w-5 text-green-600" />;
      case "EUR":
        return <Euro className="h-5 w-5 text-blue-600" />;
      case "CAD":
        return <Banknote className="h-5 w-5 text-red-600" />;
      default:
        return <DollarSign className="h-5 w-5" />;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbols = { USD: "$", EUR: "€", CAD: "C$" };
    return `${symbols[currency as keyof typeof symbols]}${amount.toFixed(2)}`;
  };

  return (
    <div className="p-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Currency Exchange
          </h1>
          <p className="text-gray-600">
            Exchange between USD, EUR, and CAD with live rates
          </p>
        </div>

        {message && (
          <Alert className="mb-6">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {/* Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-semibold">USD Balance</p>
                    <p className="text-sm text-gray-600">US Dollar</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    ${balances.usd.toFixed(2)}
                  </p>
                  <div className="flex items-center space-x-1 text-xs text-green-600 mt-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Live</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Euro className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-semibold">EUR Balance</p>
                    <p className="text-sm text-gray-600">Euro</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    €{balances.euro.toFixed(2)}
                  </p>
                  <div className="flex items-center space-x-1 text-xs text-green-600 mt-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Live</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Banknote className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="font-semibold">CAD Balance</p>
                    <p className="text-sm text-gray-600">Canadian Dollar</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    C${balances.cad.toFixed(2)}
                  </p>
                  <div className="flex items-center space-x-1 text-xs text-green-600 mt-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Live</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Exchange Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ArrowUpRight className="h-5 w-5" />
                <span>Currency Exchange</span>
              </CardTitle>
              <CardDescription>
                Convert between different currencies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="from-currency">From</Label>
                  <Select value={fromCurrency} onValueChange={setFromCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="to-currency">To</Label>
                  <Select value={toCurrency} onValueChange={setToCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {amount && fromCurrency !== toCurrency && (
                  <p className="text-sm text-gray-600 mt-2">
                    You'll receive:{" "}
                    {formatCurrency(getConvertedAmount(), toCurrency)}
                  </p>
                )}
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span>Exchange Rate:</span>
                  <span className="font-medium">
                    1 {fromCurrency} ={" "}
                    {getCurrencyRate(fromCurrency, toCurrency).toFixed(4)}{" "}
                    {toCurrency}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleTransfer}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Processing..." : "Exchange Currency"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Live Exchange Rates</span>
              </CardTitle>
              <CardDescription>
                Real-time currency exchange rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="font-medium">USD → EUR</span>
                  </div>
                  <span className="font-bold">
                    {exchangeRates.usd_to_eur.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="font-medium">USD → CAD</span>
                  </div>
                  <span className="font-bold">
                    {exchangeRates.usd_to_cad.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Euro className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">EUR → USD</span>
                  </div>
                  <span className="font-bold">
                    {exchangeRates.eur_to_usd.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Banknote className="h-4 w-4 text-red-600" />
                    <span className="font-medium">CAD → USD</span>
                  </div>
                  <span className="font-bold">
                    {exchangeRates.cad_to_usd.toFixed(4)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Recent Exchanges</span>
            </CardTitle>
            <CardDescription>Your currency exchange history</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ArrowUpRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No exchanges yet</p>
                <p className="text-sm">
                  Start exchanging currencies to see your transaction history
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-full bg-gray-100">
                        <ArrowUpRight className="h-5 w-5 text-black-600" />
                      </div>
                      <div>
                        <p className="font-medium">Currency Exchange</p>
                        <p className="text-sm text-gray-600">
                          {transaction.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(transaction.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(
                          transaction.amount,
                          transaction.currency
                        )}
                      </p>
                      <Badge
                        variant={
                          transaction.status === "completed"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {transaction.status}
                      </Badge>
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
