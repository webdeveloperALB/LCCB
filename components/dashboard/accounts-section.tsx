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
import { Plus, Trash2, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface UserProfile {
  id: string;
  client_id: string;
  full_name: string;
  email: string;
  created_at?: string;
  updated_at?: string;
}

interface AccountsSectionProps {
  userProfile: UserProfile;
}

export default function AccountsSection({ userProfile }: AccountsSectionProps) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    account_name: "",
    bank_name: "",
    account_number: "",
    routing_number: "",
    account_type: "Checking",
    currency: "USD",
  });

  useEffect(() => {
    if (userProfile?.id) {
      fetchAccounts();
    }
  }, [userProfile?.id]);

  const fetchAccounts = async () => {
    if (!userProfile?.id) return;

    try {
      setError(null);
      console.log("Fetching accounts for user:", userProfile.id);

      const { data, error: fetchError } = await supabase
        .from("external_accounts")
        .select("*")
        .eq("user_id", userProfile.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Supabase error:", fetchError);
        throw new Error(`Database error: ${fetchError.message}`);
      }

      console.log("Fetched accounts:", data);
      setAccounts(data || []);
    } catch (error: any) {
      console.error("Error fetching accounts:", error);
      setError(error.message || "Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  };

  const addAccount = async () => {
    if (!userProfile?.id) return;

    try {
      setError(null);

      const { error } = await supabase.from("external_accounts").insert({
        user_id: userProfile.id,
        ...formData,
      });

      if (error) throw error;

      setFormData({
        account_name: "",
        bank_name: "",
        account_number: "",
        routing_number: "",
        account_type: "Checking",
        currency: "USD",
      });
      setShowAddForm(false);
      fetchAccounts();
      alert("Account added successfully!");
    } catch (error: any) {
      console.error("Error adding account:", error);
      setError(error.message || "Failed to add account");
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      setError(null);
      const { error } = await supabase
        .from("external_accounts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      fetchAccounts();
      alert("Account deleted successfully!");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      setError(error.message || "Failed to delete account");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A7F8D]"></div>
            <span className="ml-2">Loading accounts...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <div>
                  <h3 className="font-medium text-red-800">
                    Error Loading Accounts
                  </h3>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                  <Button
                    onClick={fetchAccounts}
                    variant="outline"
                    size="sm"
                    className="mt-3 border-red-300 text-red-700 hover:bg-red-100 bg-transparent"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 py-xs-16 space-y-6">
        <div className="flex items-center gap-x-14">
          <h2 className="text-2xl font-bold">External Bank Accounts</h2>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-[#0A7F8D] hover:bg-[#0A7F8D]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Account
          </Button>
        </div>

        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add New Bank Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="account_name">Account Name</Label>
                  <Input
                    id="account_name"
                    value={formData.account_name}
                    onChange={(e) =>
                      setFormData({ ...formData, account_name: e.target.value })
                    }
                    placeholder="My Checking Account"
                  />
                </div>
                <div>
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_name: e.target.value })
                    }
                    placeholder="Bank"
                  />
                </div>
                <div>
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={formData.account_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        account_number: e.target.value,
                      })
                    }
                    placeholder="1234567890"
                  />
                </div>
                <div>
                  <Label htmlFor="routing_number">Routing Number</Label>
                  <Input
                    id="routing_number"
                    value={formData.routing_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        routing_number: e.target.value,
                      })
                    }
                    placeholder="021000021"
                  />
                </div>
                <div>
                  <Label htmlFor="account_type">Account Type</Label>
                  <Select
                    value={formData.account_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, account_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Checking">Checking</SelectItem>
                      <SelectItem value="Savings">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, currency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={addAccount}
                  className="bg-[#0A7F8D] hover:bg-[#0A7F8D]"
                >
                  Add Account
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {accounts.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500">No external accounts added yet.</p>
              </CardContent>
            </Card>
          ) : (
            accounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {account.account_name}
                      </h3>
                      <p className="text-gray-600">{account.bank_name}</p>
                      <p className="text-sm text-gray-500">
                        {account.account_type} • {account.currency}
                      </p>
                      <p className="text-sm text-gray-500">
                        ****{account.account_number.slice(-4)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.is_verified ? (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Verified
                        </div>
                      ) : (
                        <div className="flex items-center text-yellow-600">
                          <XCircle className="w-4 h-4 mr-1" />
                          Pending
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAccount(account.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
