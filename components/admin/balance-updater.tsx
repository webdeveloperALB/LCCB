"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Euro,
  Bitcoin,
  Coins,
  Banknote,
  TrendingUp,
  TrendingDown,
  Settings,
  Shield,
  Crown,
  UserCheck,
  AlertTriangle,
  Search,
  Users,
  Loader2,
  CheckCircle,
  X,
} from "lucide-react";

interface CurrentAdmin {
  id: string;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
  client_id: string;
  password: string | null;
}

export default function EnhancedBalanceUpdater() {
  // Core state
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [accessibleUserIds, setAccessibleUserIds] = useState<string[]>([]);
  const [accessibleUserIdsLoaded, setAccessibleUserIdsLoaded] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  // Form state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [currency, setCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [userBalances, setUserBalances] = useState<{
    usd?: number;
    euro?: number;
    cad?: number;
    btc?: number;
    eth?: number;
    usdt?: number;
  } | null>(null);
  const [operation, setOperation] = useState("add");

  // Currencies configuration - STABLE
  const currencies = useMemo(
    () => [
      {
        value: "usd",
        label: "US Dollar",
        symbol: "$",
        icon: DollarSign,
        color: "bg-green-500",
        step: "0.01",
        table: "usd_balances",
      },
      {
        value: "euro",
        label: "Euro",
        symbol: "€",
        icon: Euro,
        color: "bg-blue-500",
        step: "0.01",
        table: "euro_balances",
      },
      {
        value: "cad",
        label: "Canadian Dollar",
        symbol: "C$",
        icon: Banknote,
        color: "bg-red-500",
        step: "0.01",
        table: "cad_balances",
      },
      {
        value: "BTC",
        label: "Bitcoin",
        symbol: "₿",
        icon: Bitcoin,
        color: "bg-orange-500",
        step: "0.00000001",
        table: "newcrypto_balances",
        column: "btc_balance",
      },
      {
        value: "ETH",
        label: "Ethereum",
        symbol: "Ξ",
        icon: Coins,
        color: "bg-blue-600",
        step: "0.00000001",
        table: "newcrypto_balances",
        column: "eth_balance",
      },
      {
        value: "USDT",
        label: "Tether USD",
        symbol: "$",
        icon: DollarSign,
        color: "bg-green-600",
        step: "0.000001",
        table: "newcrypto_balances",
        column: "usdt_balance",
      },
    ],
    []
  );

  // Get current admin info - STABLE FUNCTION
  const getCurrentAdmin =
    useCallback(async (): Promise<CurrentAdmin | null> => {
      try {
        const currentSession = localStorage.getItem("current_admin_session");
        if (!currentSession) {
          console.log("No current admin session found");
          return null;
        }

        const sessionData = JSON.parse(currentSession);
        console.log("Current session data:", sessionData);

        const { data: adminData, error } = await supabase
          .from("users")
          .select("id, is_admin, is_manager, is_superiormanager")
          .eq("id", sessionData.userId)
          .single();

        if (error) {
          console.error("Failed to get admin data:", error);
          return null;
        }

        console.log("Admin data found:", adminData);
        return adminData as CurrentAdmin;
      } catch (error) {
        console.error("Failed to get current admin:", error);
        return null;
      }
    }, []);

  // Get accessible user IDs - STABLE FUNCTION
  const loadAccessibleUserIds = useCallback(
    async (admin: CurrentAdmin): Promise<string[]> => {
      if (!admin) {
        console.log("No admin provided to loadAccessibleUserIds");
        return [];
      }

      console.log("Getting accessible users for admin:", admin);

      // Full admin (is_admin: true, is_superiormanager: false, is_manager: false) - can see everyone
      if (admin.is_admin && !admin.is_superiormanager && !admin.is_manager) {
        console.log("Full admin - can see all users");
        return []; // Empty array means no filter (see all)
      }

      // Superior manager (is_admin: true, is_superiormanager: true) - can see their managers and their assigned users
      if (admin.is_admin && admin.is_superiormanager) {
        console.log("Superior manager loading accessible users for:", admin.id);

        try {
          // Get managers assigned to this superior manager
          const { data: managerAssignments, error: managerError } =
            await supabase
              .from("user_assignments")
              .select("assigned_user_id")
              .eq("manager_id", admin.id);

          if (managerError) {
            console.error("Error fetching manager assignments:", managerError);
            return [admin.id];
          }

          const managerIds =
            managerAssignments?.map((a) => a.assigned_user_id) || [];
          console.log("Superior manager's assigned managers:", managerIds);

          if (managerIds.length > 0) {
            // Verify these are actually managers (not other superior managers or regular users)
            const { data: verifiedManagers, error: verifyError } =
              await supabase
                .from("users")
                .select("id")
                .in("id", managerIds)
                .eq("is_manager", true)
                .eq("is_superiormanager", false); // Only regular managers, not other superior managers

            if (verifyError) {
              console.error("Error verifying managers:", verifyError);
              return [admin.id];
            }

            const verifiedManagerIds =
              verifiedManagers?.map((m: any) => m.id) || [];
            console.log("Verified manager IDs:", verifiedManagerIds);

            if (verifiedManagerIds.length > 0) {
              // Get users assigned to those verified managers
              const { data: userAssignments, error: userError } = await supabase
                .from("user_assignments")
                .select("assigned_user_id")
                .in("manager_id", verifiedManagerIds);

              if (userError) {
                console.error("Error fetching user assignments:", userError);
                return [admin.id, ...verifiedManagerIds];
              }

              const userIds =
                userAssignments?.map((a) => a.assigned_user_id) || [];

              // Filter out any admin/manager users from the assigned users list
              const { data: verifiedUsers, error: verifyUsersError } =
                await supabase
                  .from("users")
                  .select("id")
                  .in("id", userIds)
                  .eq("is_admin", false)
                  .eq("is_manager", false)
                  .eq("is_superiormanager", false);

              if (verifyUsersError) {
                console.error("Error verifying users:", verifyUsersError);
                return [admin.id, ...verifiedManagerIds];
              }

              const verifiedUserIds =
                verifiedUsers?.map((u: any) => u.id) || [];
              const accessibleIds = [
                admin.id,
                ...verifiedManagerIds,
                ...verifiedUserIds,
              ];
              console.log(
                "Superior manager can access (verified):",
                accessibleIds
              );
              return accessibleIds;
            }
          }

          console.log("Superior manager has no verified managers");
          return [admin.id];
        } catch (error) {
          console.error("Error in superior manager logic:", error);
          return [admin.id];
        }
      }

      // Manager (is_manager: true) - can only see assigned users (not other managers)
      if (admin.is_manager) {
        console.log("Manager loading accessible users for:", admin.id);

        try {
          const { data: userAssignments, error: userError } = await supabase
            .from("user_assignments")
            .select("assigned_user_id")
            .eq("manager_id", admin.id);

          if (userError) {
            console.error(
              "Error fetching user assignments for manager:",
              userError
            );
            return [admin.id];
          }

          const assignedUserIds =
            userAssignments?.map((a) => a.assigned_user_id) || [];
          console.log("Manager's assigned user IDs:", assignedUserIds);

          if (assignedUserIds.length > 0) {
            // Verify these are regular users (not managers or admins)
            const { data: verifiedUsers, error: verifyError } = await supabase
              .from("users")
              .select("id")
              .in("id", assignedUserIds)
              .eq("is_admin", false)
              .eq("is_manager", false)
              .eq("is_superiormanager", false);

            if (verifyError) {
              console.error("Error verifying assigned users:", verifyError);
              return [admin.id];
            }

            const verifiedUserIds = verifiedUsers?.map((u: any) => u.id) || [];
            const accessibleIds = [admin.id, ...verifiedUserIds];
            console.log(
              "Manager can access (verified users only):",
              accessibleIds
            );
            return accessibleIds;
          }

          console.log("Manager has no verified assigned users");
          return [admin.id];
        } catch (error) {
          console.error("Error in manager logic:", error);
          return [admin.id];
        }
      }

      console.log("No valid admin role found");
      return [];
    },
    []
  );

  // Check if user has full admin access (is_admin: true, others: false)
  const hasFullAdminAccess = useMemo(() => {
    return (
      currentAdmin?.is_admin === true &&
      currentAdmin?.is_manager === false &&
      currentAdmin?.is_superiormanager === false
    );
  }, [currentAdmin]);

  // Get admin level description
  const getAdminLevelDescription = useMemo(() => {
    if (!currentAdmin) return "Loading permissions...";

    if (
      currentAdmin.is_admin &&
      !currentAdmin.is_superiormanager &&
      !currentAdmin.is_manager
    ) {
      return "Full Administrator - Can update balances for all users";
    }
    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      return "Superior Manager - Can update balances for assigned managers and their users";
    }
    if (currentAdmin.is_manager) {
      return "Manager - Can update balances for assigned users only";
    }
    return "No admin permissions";
  }, [currentAdmin]);

  // Get role badges for user
  const getRoleBadges = useCallback((user: User) => {
    const roles = [];
    if (user.is_superiormanager)
      roles.push({
        label: "Superior Manager",
        color: "bg-purple-100 text-purple-800",
      });
    else if (user.is_manager)
      roles.push({ label: "Manager", color: "bg-blue-100 text-blue-800" });
    if (user.is_admin)
      roles.push({ label: "Admin", color: "bg-red-100 text-red-800" });
    return roles;
  }, []);

  // User search with cached accessible IDs
  useEffect(() => {
    if (!currentAdmin || !accessibleUserIdsLoaded || userSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        console.log("Searching users with hierarchy for:", userSearch);

        const searchLower = userSearch.toLowerCase();

        // Build base query
        let query = supabase
          .from("users")
          .select(
            "id, email, full_name, password, is_admin, is_manager, is_superiormanager"
          ) // ✅ added password
          .or(`email.ilike.%${searchLower}%,full_name.ilike.%${searchLower}%`);

        // Use cached accessible user IDs
        console.log(
          "Search using cached accessible user IDs:",
          accessibleUserIds
        );

        if (accessibleUserIds.length > 0) {
          // Filter to only accessible users
          console.log(
            "Filtering search to accessible user IDs:",
            accessibleUserIds
          );
          query = query.in("id", accessibleUserIds);
        } else if (
          currentAdmin.is_admin &&
          !currentAdmin.is_superiormanager &&
          !currentAdmin.is_manager
        ) {
          // Full admin sees everyone - no filter needed
          console.log("Full admin search - no filter applied");
        } else {
          // No accessible users
          console.log("No accessible users for search");
          query = query.eq("id", "00000000-0000-0000-0000-000000000000"); // No results
        }

        const { data, error } = await query
          .limit(20)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const transformedUsers = data.map((user: any) => ({
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            password: user.password, // ✅ added
            is_admin: user.is_admin || false,
            is_manager: user.is_manager || false,
            is_superiormanager: user.is_superiormanager || false,
            client_id: `DCB${user.id.slice(0, 6)}`,
          }));

          console.log(
            `Found ${transformedUsers.length} accessible users for search`
          );
          setSearchResults(transformedUsers);
        } else {
          console.error("Search error:", error);
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [userSearch, currentAdmin, accessibleUserIds, accessibleUserIdsLoaded]);

  // Helper functions
  const createTransferRecord = async (transferData: any) => {
    try {
      console.log("Creating transfer record:", transferData);
      const { data, error } = await supabase
        .from("transfers")
        .insert(transferData)
        .select();

      if (error) {
        console.error("Transfer creation error:", error);
        return { success: false, error };
      }

      console.log("Transfer created successfully:", data);
      return { success: true, data };
    } catch (err) {
      console.error("Transfer creation exception:", err);
      return { success: false, error: err };
    }
  };

  // ✅ Fetch balances for selected user
  const fetchUserBalances = useCallback(async (userId: string) => {
    try {
      const results = await Promise.all([
        supabase
          .from("usd_balances")
          .select("balance")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("euro_balances")
          .select("balance")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("cad_balances")
          .select("balance")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("newcrypto_balances")
          .select("btc_balance, eth_balance, usdt_balance")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      const [usdRes, eurRes, cadRes, cryptoRes] = results;

      setUserBalances({
        usd: usdRes.data?.balance ?? 0,
        euro: eurRes.data?.balance ?? 0,
        cad: cadRes.data?.balance ?? 0,
        btc: cryptoRes.data?.btc_balance ?? 0,
        eth: cryptoRes.data?.eth_balance ?? 0,
        usdt: cryptoRes.data?.usdt_balance ?? 0,
      });

      console.log("Loaded balances for user:", {
        usd: usdRes.data?.balance,
        euro: eurRes.data?.balance,
        cad: cadRes.data?.balance,
        btc: cryptoRes.data?.btc_balance,
        eth: cryptoRes.data?.eth_balance,
        usdt: cryptoRes.data?.usdt_balance,
      });
    } catch (error) {
      console.error("Error loading user balances:", error);
      setUserBalances(null);
    }
  }, []);

  const updateBalance = async () => {
    if (!selectedUser || !currency || !amount) {
      setMessage("Please fill all fields and select a user");
      return;
    }

    if (!currentAdmin) {
      setMessage("Admin session not found");
      return;
    }

    // Check if admin can update balance for this user
    const canUpdateBalance =
      accessibleUserIds.length === 0 || // Full admin
      accessibleUserIds.includes(selectedUser.id); // User is accessible

    if (!canUpdateBalance) {
      setMessage(
        "❌ You don't have permission to update balances for this user"
      );
      return;
    }

    setLoading(true);
    try {
      const userId = selectedUser.id;
      const selectedCurrency = currencies.find((c) => c.value === currency);
      const amountValue = Number.parseFloat(amount);

      if (!selectedCurrency) {
        throw new Error("Invalid currency selected");
      }

      // Handle crypto currencies differently
      if (["BTC", "ETH", "USDT"].includes(currency)) {
        try {
          const { data, error } = await supabase.rpc("update_crypto_balance", {
            p_user_id: userId,
            p_crypto_type: currency,
            p_amount: amountValue,
            p_operation: operation,
          });

          if (error) throw error;

          // Create transfer record for crypto
          const transferData = {
            user_id: userId,
            client_id: userId,
            from_currency: currency.toLowerCase(),
            to_currency: currency.toLowerCase(),
            from_amount: amountValue,
            to_amount: amountValue,
            exchange_rate: 1.0,
            status: "completed",
            transfer_type:
              operation === "add"
                ? "admin_crypto_deposit"
                : operation === "subtract"
                ? "admin_crypto_debit"
                : "admin_crypto_adjustment",
            description:
              operation === "add"
                ? `Crypto Credit - ${amountValue.toFixed(
                    8
                  )} ${currency} has been deposited to your account`
                : operation === "subtract"
                ? `Crypto Debit - ${amountValue.toFixed(
                    8
                  )} ${currency} has been debited from your account`
                : `Crypto Balance Adjustment - Account balance set to ${amountValue.toFixed(
                    8
                  )} ${currency}`,
          };

          const transferResult = await createTransferRecord(transferData);

          if (transferResult.success) {
            setMessage(
              `✅ Successfully ${
                operation === "add"
                  ? "added"
                  : operation === "subtract"
                  ? "subtracted"
                  : "set"
              } ${amount} ${currency} ${
                operation === "add"
                  ? "to"
                  : operation === "subtract"
                  ? "from"
                  : "for"
              } ${selectedUser.email} and logged to activity`
            );
          } else {
            setMessage(
              `⚠️ ${currency} balance updated but activity logging failed`
            );
          }
        } catch (error: any) {
          throw new Error(`Crypto balance update failed: ${error.message}`);
        }
      } else {
        // Handle traditional currencies (USD, EUR, CAD)
        const tableName = selectedCurrency.table;

        if (operation === "set") {
          const { error } = await supabase
            .from(tableName)
            .update({ balance: amountValue })
            .eq("user_id", userId);

          if (error) throw error;

          const transferData = {
            user_id: userId,
            client_id: userId,
            from_currency: currency.toLowerCase(),
            to_currency: currency.toLowerCase(),
            from_amount: amountValue,
            to_amount: amountValue,
            exchange_rate: 1.0,
            status: "completed",
            transfer_type: "admin_balance_adjustment",
            description: `Account Balance Adjustment - Account balance set to ${amountValue.toLocaleString()} ${currency.toUpperCase()}`,
          };

          const transferResult = await createTransferRecord(transferData);
          if (transferResult.success) {
            setMessage(
              `✅ Successfully set ${currency} balance to ${amount} for ${selectedUser.email} and logged to activity`
            );
          } else {
            setMessage(
              `⚠️ Balance updated to ${amount} for ${selectedUser.email} but activity logging failed`
            );
          }
        } else {
          // Get current balance first
          const { data: currentData, error: fetchError } = await supabase
            .from(tableName)
            .select("balance")
            .eq("user_id", userId)
            .single();

          if (fetchError) {
            if (fetchError.code === "PGRST116") {
              const newBalance = operation === "add" ? amountValue : 0;
              const { error: insertError } = await supabase
                .from(tableName)
                .insert({
                  user_id: userId,
                  balance: newBalance,
                });

              if (insertError) throw insertError;

              const transferData = {
                user_id: userId,
                client_id: userId,
                from_currency: currency.toLowerCase(),
                to_currency: currency.toLowerCase(),
                from_amount: newBalance,
                to_amount: newBalance,
                exchange_rate: 1.0,
                status: "completed",
                transfer_type:
                  operation === "add" ? "admin_deposit" : "admin_debit",
                description:
                  operation === "add"
                    ? `Account Credit - ${newBalance.toLocaleString()} ${currency.toUpperCase()} has been deposited to your account`
                    : `Account Setup - New ${currency.toUpperCase()} account created`,
              };

              const transferResult = await createTransferRecord(transferData);
              if (transferResult.success) {
                setMessage(
                  `✅ Created new ${currency} balance: ${newBalance} for ${selectedUser.email} and logged to activity`
                );
              } else {
                setMessage(
                  `⚠️ Created new ${currency} balance: ${newBalance} for ${selectedUser.email} but activity logging failed`
                );
              }
            } else {
              throw fetchError;
            }
          } else {
            const currentBalance = currentData.balance || 0;
            const newBalance =
              operation === "add"
                ? currentBalance + amountValue
                : Math.max(0, currentBalance - amountValue);

            const { error: updateError } = await supabase
              .from(tableName)
              .update({ balance: newBalance })
              .eq("user_id", userId);

            if (updateError) throw updateError;

            const transferData = {
              user_id: userId,
              client_id: userId,
              from_currency: currency.toLowerCase(),
              to_currency: currency.toLowerCase(),
              from_amount: operation === "add" ? amountValue : currentBalance,
              to_amount: operation === "add" ? newBalance : amountValue,
              exchange_rate: 1.0,
              status: "completed",
              transfer_type:
                operation === "add" ? "admin_deposit" : "admin_debit",
              description:
                operation === "add"
                  ? `Account Credit - ${amountValue.toLocaleString()} ${currency.toUpperCase()} has been deposited to your account`
                  : `Account Debit - ${amountValue.toLocaleString()} ${currency.toUpperCase()} has been debited from your account`,
            };

            const transferResult = await createTransferRecord(transferData);
            if (transferResult.success) {
              setMessage(
                `✅ Successfully ${
                  operation === "add" ? "added" : "subtracted"
                } ${amount} ${
                  operation === "add" ? "to" : "from"
                } ${currency} balance for ${
                  selectedUser.email
                }. New balance: ${newBalance}. Activity logged.`
              );
            } else {
              setMessage(
                `⚠️ Successfully ${
                  operation === "add" ? "added" : "subtracted"
                } ${amount} ${
                  operation === "add" ? "to" : "from"
                } ${currency} balance for ${
                  selectedUser.email
                }. New balance: ${newBalance}. Activity logging failed.`
              );
            }
          }
        }
      }

      // Clear form
      setSelectedUser(null);
      setUserSearch("");
      setCurrency("");
      setAmount("");
    } catch (error: any) {
      console.error("Main error:", error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // EFFECT 1: Initialize current admin - NO DEPENDENCIES ON OTHER FUNCTIONS
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const admin = await getCurrentAdmin();
        if (mounted) {
          setCurrentAdmin(admin);
        }
      } catch (error) {
        console.error("Failed to initialize:", error);
        if (mounted) {
          setMessage("Failed to load admin permissions");
        }
      } finally {
        if (mounted) {
          setLoadingPermissions(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []); // NO DEPENDENCIES

  // EFFECT 2: Load accessible user IDs when admin changes - STABLE
  useEffect(() => {
    let mounted = true;

    if (!currentAdmin) {
      setAccessibleUserIds([]);
      setAccessibleUserIdsLoaded(false);
      return;
    }

    const loadUserIds = async () => {
      try {
        console.log("Loading accessible user IDs for admin:", currentAdmin);
        const userIds = await loadAccessibleUserIds(currentAdmin);
        if (mounted) {
          setAccessibleUserIds(userIds);
          setAccessibleUserIdsLoaded(true);
          console.log("Cached accessible user IDs:", userIds);
        }
      } catch (error) {
        console.error("Failed to load accessible users:", error);
        if (mounted) {
          setAccessibleUserIds([]);
          setAccessibleUserIdsLoaded(true);
        }
      }
    };

    loadUserIds();

    return () => {
      mounted = false;
    };
  }, [currentAdmin, loadAccessibleUserIds]); // Only depends on currentAdmin and stable function

  const selectedCurrency = currencies.find((c) => c.value === currency);
  const IconComponent = selectedCurrency?.icon || DollarSign;

  // Loading state
  if (loadingPermissions) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin permissions...</p>
        </CardContent>
      </Card>
    );
  }

  // No admin session
  if (!currentAdmin) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Session Error
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Admin Session Not Found
          </h3>
          <p className="text-gray-600 mb-4">
            Unable to verify your admin permissions. Please log in again.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Check if user has any admin access
  if (!currentAdmin.is_admin && !currentAdmin.is_manager) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <Shield className="w-5 h-5 mr-2" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Admin Access Required
          </h3>
          <p className="text-gray-600 mb-4">
            You need admin or manager permissions to update user balances.
          </p>
          <div className="space-y-2 text-sm text-gray-500">
            <p>Your current permissions:</p>
            <div className="flex justify-center space-x-2">
              <Badge
                className={
                  currentAdmin.is_admin
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }
              >
                Admin: {currentAdmin.is_admin ? "Yes" : "No"}
              </Badge>
              <Badge
                className={
                  currentAdmin.is_manager
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-800"
                }
              >
                Manager: {currentAdmin.is_manager ? "Yes" : "No"}
              </Badge>
              <Badge
                className={
                  currentAdmin.is_superiormanager
                    ? "bg-purple-100 text-purple-800"
                    : "bg-gray-100 text-gray-800"
                }
              >
                Superior: {currentAdmin.is_superiormanager ? "Yes" : "No"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-[#F26623]" />
            Balance Updater (Admin)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-green-500 bg-green-50">
            <AlertDescription className="text-green-700">
              ✅ Balance updates and transfer history logging are both active.
              Admin actions will appear in user dashboards with proper crypto
              support.
            </AlertDescription>
          </Alert>

          {/* User Search Section */}
          <div className="space-y-2">
            <Label>Search and Select User *</Label>
            {selectedUser ? (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">
                      {selectedUser.full_name || selectedUser.email}
                    </p>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm text-green-600">
                        {selectedUser.client_id} • {selectedUser.email}
                      </p>
                      <p className="text-xs text-gray-500">
                        🔑 Password: {selectedUser.password || "N/A"}
                      </p>

                      {getRoleBadges(selectedUser).map((role, index) => (
                        <Badge key={index} className={`text-xs ${role.color}`}>
                          {role.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedUser(null);
                    setUserSearch("");
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder={
                      currentAdmin.is_admin &&
                      !currentAdmin.is_superiormanager &&
                      !currentAdmin.is_manager
                        ? "Search any user by name or email..."
                        : currentAdmin.is_admin &&
                          currentAdmin.is_superiormanager
                        ? "Search your assigned managers and their users..."
                        : "Search your assigned users..."
                    }
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>

                {userSearch.length >= 2 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.length > 0 ? (
                      searchResults.map((user) => {
                        const roles = getRoleBadges(user);
                        return (
                          <div
                            key={user.id}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                            onClick={() => {
                              setSelectedUser(user);
                              setUserSearch("");
                              setSearchResults([]);
                              fetchUserBalances(user.id); // ✅ Load balances after selecting user
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Users className="h-4 w-4 text-gray-400" />
                                <div>
                                  <p className="font-medium text-sm">
                                    {user.full_name ||
                                      user.email?.split("@")[0] ||
                                      "Unknown User"}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {user.client_id} • {user.email}
                                  </p>
                                </div>
                              </div>
                              <div className="flex space-x-1">
                                {roles.map((role, index) => (
                                  <Badge
                                    key={index}
                                    className={`text-xs ${role.color}`}
                                  >
                                    {role.label}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : !searching ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No users found matching "{userSearch}"
                        {currentAdmin.is_manager && (
                          <p className="text-xs mt-1">
                            You can only search users assigned to you
                          </p>
                        )}
                        {currentAdmin.is_admin &&
                          currentAdmin.is_superiormanager && (
                            <p className="text-xs mt-1">
                              You can only search managers you assigned and
                              their users
                            </p>
                          )}
                      </div>
                    ) : null}
                  </div>
                )}

                {userSearch.length > 0 && userSearch.length < 2 && (
                  <p className="text-xs text-gray-500">
                    Type at least 2 characters to search
                  </p>
                )}

                {userSearch.length === 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Search Scope:</strong> {getAdminLevelDescription}
                    </p>
                    {currentAdmin.is_manager && (
                      <p className="text-xs text-blue-600 mt-1">
                        You can only update balances for users specifically
                        assigned to you
                      </p>
                    )}
                    {currentAdmin.is_admin &&
                      currentAdmin.is_superiormanager && (
                        <p className="text-xs text-blue-600 mt-1">
                          You can update balances for managers you assigned and
                          their users
                        </p>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedUser && (
            <>
              {userBalances && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  <div className="p-3 border rounded-lg bg-white shadow-sm">
                    <p className="text-sm text-gray-600">💵 USD Balance</p>
                    <p className="text-lg font-semibold">
                      $
                      {Number(userBalances.usd).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg bg-white shadow-sm">
                    <p className="text-sm text-gray-600">💶 EUR Balance</p>
                    <p className="text-lg font-semibold">
                      €
                      {Number(userBalances.euro).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg bg-white shadow-sm">
                    <p className="text-sm text-gray-600">💷 CAD Balance</p>
                    <p className="text-lg font-semibold">
                      C$
                      {Number(userBalances.cad).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg bg-white shadow-sm">
                    <p className="text-sm text-gray-600">₿ BTC Balance</p>
                    <p className="text-lg font-semibold">
                      {Number(userBalances.btc).toFixed(8)}
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg bg-white shadow-sm">
                    <p className="text-sm text-gray-600">Ξ ETH Balance</p>
                    <p className="text-lg font-semibold">
                      {Number(userBalances.eth).toFixed(8)}
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg bg-white shadow-sm">
                    <p className="text-sm text-gray-600">$ USDT Balance</p>
                    <p className="text-lg font-semibold">
                      {Number(userBalances.usdt).toFixed(6)}
                    </p>
                  </div>
                </div>
              )}
              <Tabs
                value={operation}
                onValueChange={setOperation}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="add" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Add Funds
                  </TabsTrigger>
                  <TabsTrigger
                    value="subtract"
                    className="flex items-center gap-2"
                  >
                    <TrendingDown className="h-4 w-4" />
                    Remove Funds
                  </TabsTrigger>
                  <TabsTrigger value="set" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Set Balance
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="add" className="space-y-4 mt-4">
                  <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">
                    💰 Add funds to existing balance (will appear as "Account
                    Credit" in transfer history)
                  </div>
                </TabsContent>

                <TabsContent value="subtract" className="space-y-4 mt-4">
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                    💸 Remove funds from existing balance (will appear as
                    "Account Debit" in transfer history)
                  </div>
                </TabsContent>

                <TabsContent value="set" className="space-y-4 mt-4">
                  <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                    🔧 Set exact balance amount (will appear as "Balance
                    Adjustment" in transfer history)
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="currency" className="text-sm font-medium">
                    Currency
                  </Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Traditional Currencies
                      </div>
                      {currencies
                        .filter(
                          (c) => !["BTC", "ETH", "USDT"].includes(c.value)
                        )
                        .map((curr) => {
                          const IconComponent = curr.icon;
                          return (
                            <SelectItem key={curr.value} value={curr.value}>
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-6 h-6 rounded-full ${curr.color} flex items-center justify-center`}
                                >
                                  <IconComponent className="w-3 h-3 text-white" />
                                </div>
                                <span>{curr.label}</span>
                                <Badge variant="outline" className="text-xs">
                                  {curr.symbol}
                                </Badge>
                              </div>
                            </SelectItem>
                          );
                        })}

                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide border-t mt-2 pt-2">
                        Cryptocurrencies
                      </div>
                      {currencies
                        .filter((c) => ["BTC", "ETH", "USDT"].includes(c.value))
                        .map((curr) => {
                          const IconComponent = curr.icon;
                          return (
                            <SelectItem key={curr.value} value={curr.value}>
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-6 h-6 rounded-full ${curr.color} flex items-center justify-center`}
                                >
                                  <IconComponent className="w-3 h-3 text-white" />
                                </div>
                                <span>{curr.label}</span>
                                <Badge variant="outline" className="text-xs">
                                  {curr.symbol}
                                </Badge>
                              </div>
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="amount" className="text-sm font-medium">
                    Amount
                    {selectedCurrency && (
                      <span className="text-gray-500 ml-2">
                        ({selectedCurrency.symbol} {selectedCurrency.value})
                      </span>
                    )}
                  </Label>
                  <div className="relative mt-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      {selectedCurrency && (
                        <div
                          className={`w-5 h-5 rounded-full ${selectedCurrency.color} flex items-center justify-center`}
                        >
                          <IconComponent className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    <Input
                      id="amount"
                      type="number"
                      step={selectedCurrency?.step || "0.01"}
                      placeholder={`Enter amount${
                        selectedCurrency
                          ? ` (${selectedCurrency.step} precision)`
                          : ""
                      }`}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={`${selectedCurrency ? "pl-12" : ""} font-mono`}
                    />
                  </div>
                  {selectedCurrency &&
                    ["BTC", "ETH", "USDT"].includes(selectedCurrency.value) && (
                      <p className="text-xs text-gray-500 mt-1">
                        Cryptocurrency precision: {selectedCurrency.step}{" "}
                        {selectedCurrency.value}
                      </p>
                    )}
                </div>
              </div>

              <Button
                onClick={updateBalance}
                disabled={loading || !selectedUser || !currency || !amount}
                className="w-full bg-[#F26623] hover:bg-[#E55A1F] h-12 text-lg font-semibold"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    {operation === "add" && (
                      <TrendingUp className="h-5 w-5 mr-2" />
                    )}
                    {operation === "subtract" && (
                      <TrendingDown className="h-5 w-5 mr-2" />
                    )}
                    {operation === "set" && (
                      <Settings className="h-5 w-5 mr-2" />
                    )}
                    {operation === "add"
                      ? "Credit Account"
                      : operation === "subtract"
                      ? "Debit Account"
                      : "Adjust Balance"}
                  </>
                )}
              </Button>

              {selectedCurrency && (
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Selected Currency Info
                  </h4>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div
                      className={`w-8 h-8 rounded-full ${selectedCurrency.color} flex items-center justify-center`}
                    >
                      <IconComponent className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedCurrency.label}</p>
                      <p className="text-xs">
                        Symbol: {selectedCurrency.symbol} | Precision:{" "}
                        {selectedCurrency.step} |
                        {["BTC", "ETH", "USDT"].includes(selectedCurrency.value)
                          ? "Cryptocurrency"
                          : "Traditional Currency"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {message && (
            <div
              className={`text-sm p-3 rounded-lg border ${
                message.includes("❌")
                  ? "text-red-600 bg-red-50 border-red-200"
                  : message.includes("⚠️")
                  ? "text-yellow-600 bg-yellow-50 border-yellow-200"
                  : "text-green-600 bg-green-50 border-green-200"
              }`}
            >
              {message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
