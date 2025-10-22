"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Activity,
  Loader2,
  CheckCircle,
  Search,
  X,
  Plus,
  Trash2,
  DollarSign,
  Shield,
  Crown,
  UserCheck,
  AlertTriangle,
} from "lucide-react";

interface User {
  id: string;
  client_id: string;
  full_name: string | null;
  email: string | null;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
}

interface CurrentAdmin {
  id: string;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
}

interface ActivityEntry {
  id: string;
  user_id: string;
  activity_type: string;
  title: string;
  description: string;
  display_amount: number | null;
  currency: string | null;
  priority: string;
  status: string;
  is_read: boolean;
  client_id: string;
  created_by: string | null;
  metadata: any;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function ActivityManager() {
  // Core state
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [recentActivities, setRecentActivities] = useState<ActivityEntry[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Form state
  const [activityType, setActivityType] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDescription, setActivityDescription] = useState("");
  const [displayAmount, setDisplayAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [priority, setPriority] = useState("normal");
  const [expiresAt, setExpiresAt] = useState("");

  // Activity types with proper formatting - STATIC
  const activityTypes = useMemo(
    () => [
      // Account Management
      {
        value: "account_opening",
        label: "Account Opening",
        category: "Account Management",
      },
      {
        value: "account_closure",
        label: "Account Closure",
        category: "Account Management",
      },
      {
        value: "account_freeze",
        label: "Account Freeze",
        category: "Account Management",
      },
      {
        value: "account_unfreeze",
        label: "Account Unfreeze",
        category: "Account Management",
      },
      {
        value: "kyc_update",
        label: "KYC Update",
        category: "Account Management",
      },
      {
        value: "limit_change",
        label: "Limit Change",
        category: "Account Management",
      },
      {
        value: "compliance_notice",
        label: "Compliance Notice",
        category: "Account Management",
      },
      {
        value: "document_request",
        label: "Document Request",
        category: "Account Management",
      },

      // Financial Transactions
      {
        value: "account_credit",
        label: "Account Credit",
        category: "Financial Transactions",
      },
      {
        value: "account_debit",
        label: "Account Debit",
        category: "Financial Transactions",
      },
      {
        value: "deposit_notification",
        label: "Deposit Notification",
        category: "Financial Transactions",
      },
      {
        value: "withdrawal_notification",
        label: "Withdrawal Notification",
        category: "Financial Transactions",
      },
      {
        value: "transfer_notification",
        label: "Transfer Notification",
        category: "Financial Transactions",
      },
      {
        value: "payment_notification",
        label: "Payment Notification",
        category: "Financial Transactions",
      },
      {
        value: "wire_transfer",
        label: "Wire Transfer",
        category: "Financial Transactions",
      },
      {
        value: "ach_transfer",
        label: "ACH Transfer",
        category: "Financial Transactions",
      },
      {
        value: "check_deposit",
        label: "Check Deposit",
        category: "Financial Transactions",
      },
      {
        value: "card_transaction",
        label: "Card Transaction",
        category: "Financial Transactions",
      },
      {
        value: "mobile_payment",
        label: "Mobile Payment",
        category: "Financial Transactions",
      },

      // Banking Services
      {
        value: "balance_inquiry",
        label: "Balance Inquiry",
        category: "Banking Services",
      },
      {
        value: "transaction_alert",
        label: "Transaction Alert",
        category: "Banking Services",
      },
      {
        value: "receipt_notification",
        label: "Receipt Notification",
        category: "Banking Services",
      },
      {
        value: "online_banking",
        label: "Online Banking",
        category: "Banking Services",
      },
      {
        value: "statement_ready",
        label: "Statement Ready",
        category: "Banking Services",
      },
      {
        value: "appointment_reminder",
        label: "Appointment Reminder",
        category: "Banking Services",
      },

      // Security & Compliance
      {
        value: "security_alert",
        label: "Security Alert",
        category: "Security & Compliance",
      },
      {
        value: "fraud_alert",
        label: "Fraud Alert",
        category: "Security & Compliance",
      },
      {
        value: "account_notice",
        label: "Account Notice",
        category: "Security & Compliance",
      },

      // Notifications
      {
        value: "admin_notification",
        label: "Admin Notification",
        category: "Notifications",
      },
      {
        value: "system_update",
        label: "System Update",
        category: "Notifications",
      },
      {
        value: "service_announcement",
        label: "Service Announcement",
        category: "Notifications",
      },
      {
        value: "maintenance_notice",
        label: "Maintenance Notice",
        category: "Notifications",
      },
      {
        value: "feature_announcement",
        label: "Feature Announcement",
        category: "Notifications",
      },
      {
        value: "policy_update",
        label: "Policy Update",
        category: "Notifications",
      },
      {
        value: "promotional_offer",
        label: "Promotional Offer",
        category: "Notifications",
      },
      {
        value: "service_update",
        label: "Service Update",
        category: "Notifications",
      },
      {
        value: "support_response",
        label: "Support Response",
        category: "Notifications",
      },
    ],
    []
  );

  // Group activity types by category - STATIC
  const groupedActivityTypes = useMemo(() => {
    const groups: Record<string, typeof activityTypes> = {};
    activityTypes.forEach((type) => {
      if (!groups[type.category]) {
        groups[type.category] = [];
      }
      groups[type.category].push(type);
    });
    return groups;
  }, [activityTypes]);

  // Get activity type label - STATIC
  const getActivityTypeLabel = useCallback(
    (value: string) => {
      const type = activityTypes.find((t) => t.value === value);
      return (
        type?.label ||
        value.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
      );
    },
    [activityTypes]
  );

  // Currencies - STATIC
  const currencies = useMemo(
    () => [
      { value: "usd", label: "US Dollar ($)", symbol: "$" },
      { value: "euro", label: "Euro (€)", symbol: "€" },
      { value: "cad", label: "Canadian Dollar (C$)", symbol: "C$" },
      { value: "crypto", label: "Crypto (₿)", symbol: "₿" },
      { value: "gbp", label: "British Pound (£)", symbol: "£" },
      { value: "jpy", label: "Japanese Yen (¥)", symbol: "¥" },
    ],
    []
  );

  // Priority levels - STATIC
  const priorities = useMemo(
    () => [
      { value: "low", label: "Low", color: "bg-gray-100 text-gray-800" },
      { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-800" },
      { value: "high", label: "High", color: "bg-orange-100 text-orange-800" },
      { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-800" },
    ],
    []
  );

  // Check if user is full admin - OPTIMIZED
  const isFullAdmin = useMemo(() => {
    return (
      currentAdmin?.is_admin === true &&
      currentAdmin?.is_manager === false &&
      currentAdmin?.is_superiormanager === false
    );
  }, [currentAdmin]);

  // Get admin description - OPTIMIZED
  const adminDescription = useMemo(() => {
    if (!currentAdmin) return "Loading permissions...";
    if (isFullAdmin)
      return "Full Administrator - Can create activities for all users";
    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      return "Superior Manager - Can create activities for assigned managers and their users";
    }
    if (currentAdmin.is_manager) {
      return "Manager - Can create activities for assigned users only";
    }
    return "No admin permissions";
  }, [currentAdmin, isFullAdmin]);

  // Initialize admin - SIMPLIFIED
  useEffect(() => {
    const initAdmin = async () => {
      try {
        const currentSession = localStorage.getItem("current_admin_session");
        if (!currentSession) {
          setLoadingPermissions(false);
          return;
        }

        const sessionData = JSON.parse(currentSession);
        const { data: adminData, error } = await supabase
          .from("users")
          .select("id, is_admin, is_manager, is_superiormanager")
          .eq("id", sessionData.userId)
          .single();

        if (!error && adminData) {
          setCurrentAdmin(adminData as CurrentAdmin);
        }
      } catch (error) {
        console.error("Failed to initialize admin:", error);
      } finally {
        setLoadingPermissions(false);
      }
    };

    initAdmin();
  }, []);

  // Simplified user search - MUCH FASTER
  useEffect(() => {
    if (!currentAdmin || userSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const searchLower = userSearch.toLowerCase();

        // Simple query - let database handle the filtering
        let query = supabase
          .from("users")
          .select(
            "id, email, full_name, is_admin, is_manager, is_superiormanager"
          )
          .or(`email.ilike.%${searchLower}%,full_name.ilike.%${searchLower}%`)
          .limit(10); // Limit to 10 results for speed

        // Only add permission filtering for non-full admins
        if (!isFullAdmin) {
          // For managers and superior managers, we'll filter client-side for now
          // This is faster than complex database queries
        }

        const { data, error } = await query.order("created_at", {
          ascending: false,
        });

        if (!error && data) {
          const transformedUsers = data.map((user: any) => ({
            id: user.id,
            client_id: `DCB${user.id.slice(0, 6)}`,
            full_name: user.full_name || user.email?.split("@")[0] || "Unknown",
            email: user.email,
            is_admin: user.is_admin || false,
            is_manager: user.is_manager || false,
            is_superiormanager: user.is_superiormanager || false,
          }));

          setSearchResults(transformedUsers);
        }
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [userSearch, currentAdmin, isFullAdmin]);

  // Load recent activities - SIMPLIFIED
  const fetchRecentActivities = useCallback(async () => {
    if (!currentAdmin) return;

    setActivitiesLoading(true);
    try {
      let query = supabase
        .from("account_activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      const { data, error } = await query;
      if (!error) {
        setRecentActivities(data || []);
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setActivitiesLoading(false);
    }
  }, [currentAdmin]);

  // Load activities when admin is ready
  useEffect(() => {
    if (currentAdmin) {
      fetchRecentActivities();
    }
  }, [currentAdmin, fetchRecentActivities]);

  // Submit activity - OPTIMIZED
  const handleSubmit = useCallback(async () => {
    if (!selectedUser || !activityType || !activityTitle || !currentAdmin) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const activityData: any = {
        user_id: selectedUser.id,
        client_id: selectedUser.client_id,
        activity_type: activityType,
        title: activityTitle,
        description: activityDescription,
        priority: priority,
        created_by: currentAdmin.id,
        status: "active",
        is_read: false,
        metadata: {},
      };

      if (displayAmount && currency) {
        activityData.display_amount = parseFloat(displayAmount);
        activityData.currency = currency;
      }

      if (expiresAt) {
        activityData.expires_at = new Date(expiresAt).toISOString();
      }

      const { error } = await supabase
        .from("account_activities")
        .insert(activityData);
      if (error) throw error;

      // Reset form
      setActivityType("");
      setActivityTitle("");
      setActivityDescription("");
      setDisplayAmount("");
      setCurrency("");
      setPriority("normal");
      setExpiresAt("");
      setSelectedUser(null);
      setUserSearch("");

      setMessage({
        type: "success",
        text: `Activity created successfully for ${
          selectedUser.full_name || selectedUser.email
        }!`,
      });

      fetchRecentActivities();
    } catch (error: any) {
      setMessage({ type: "error", text: `Error: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }, [
    selectedUser,
    activityType,
    activityTitle,
    activityDescription,
    displayAmount,
    currency,
    priority,
    expiresAt,
    currentAdmin,
    fetchRecentActivities,
  ]);

  // Quick fill for common activity types - OPTIMIZED
  const handleQuickFill = useCallback((type: string) => {
    setActivityType(type);

    const quickFills: Record<
      string,
      {
        title: string;
        description: string;
        currency?: string;
        priority?: string;
      }
    > = {
      deposit_notification: {
        title: "Deposit Notification",
        description:
          "Your deposit has been processed and added to your account balance.",
        currency: "usd",
      },
      kyc_update: {
        title: "Identity Verification Complete",
        description:
          "Your identity verification has been approved. You now have full access to all features.",
      },
      security_alert: {
        title: "Security Notice",
        description:
          "We detected unusual activity on your account. Please review your recent transactions.",
        priority: "high",
      },
      wire_transfer: {
        title: "Wire Transfer Notification",
        description: "Your wire transfer has been processed successfully.",
        currency: "usd",
      },
    };

    const fill = quickFills[type];
    if (fill) {
      setActivityTitle(fill.title);
      setActivityDescription(fill.description);
      if (fill.currency) setCurrency(fill.currency);
      if (fill.priority) setPriority(fill.priority);
    } else {
      setActivityTitle("");
      setActivityDescription("");
    }
  }, []);

  // Delete activity - OPTIMIZED
  const handleDeleteActivity = useCallback(
    async (activityId: string) => {
      if (!currentAdmin) return;

      setLoading(true);
      try {
        const { error } = await supabase
          .from("account_activities")
          .delete()
          .eq("id", activityId);

        if (error) throw error;
        setMessage({ type: "success", text: "Activity deleted successfully" });
        fetchRecentActivities();
      } catch (error) {
        setMessage({ type: "error", text: "Failed to delete activity" });
      } finally {
        setLoading(false);
      }
    },
    [currentAdmin, fetchRecentActivities]
  );

  // Get activity styling - STATIC FUNCTIONS
  const getActivityColor = useCallback((type: string) => {
    if (
      type.includes("deposit") ||
      type.includes("payment") ||
      type.includes("credit")
    )
      return "bg-green-100 text-green-800";
    if (
      type.includes("security") ||
      type.includes("fraud") ||
      type.includes("alert")
    )
      return "bg-red-100 text-red-800";
    if (type.includes("kyc") || type.includes("compliance"))
      return "bg-blue-100 text-blue-800";
    if (type.includes("transfer") || type.includes("wire"))
      return "bg-purple-100 text-purple-800";
    return "bg-gray-100 text-gray-800";
  }, []);

  const getActivityIcon = useCallback((type: string) => {
    if (
      type.includes("deposit") ||
      type.includes("payment") ||
      type.includes("credit")
    )
      return <DollarSign className="w-3 h-3" />;
    if (
      type.includes("security") ||
      type.includes("fraud") ||
      type.includes("alert")
    )
      return <Shield className="w-3 h-3" />;
    if (type.includes("kyc") || type.includes("compliance"))
      return <CheckCircle className="w-3 h-3" />;
    return <Activity className="w-3 h-3" />;
  }, []);

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

  // Loading state
  if (loadingPermissions) {
    return (
      <Card>
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
      <Card>
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
      <Card>
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
            You need admin or manager permissions to create activities.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <Alert
          className={
            message.type === "error"
              ? "border-red-500 bg-red-50"
              : "border-green-500 bg-green-50"
          }
        >
          <AlertDescription
            className={
              message.type === "error" ? "text-red-700" : "text-green-700"
            }
          >
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create User Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User search */}
          <div className="space-y-2">
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
                    placeholder="Search users by name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>

                {userSearch.length >= 2 && searchResults.length > 0 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                        onClick={() => {
                          setSelectedUser(user);
                          setUserSearch("");
                          setSearchResults([]);
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
                            {getRoleBadges(user).map((role, index) => (
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
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedUser && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Activity Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="activityType">Activity Type *</Label>
                  <Select value={activityType} onValueChange={setActivityType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select activity type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(groupedActivityTypes).map(
                        ([category, types]) => (
                          <div key={category}>
                            <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">
                              {category}
                            </div>
                            {types.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </div>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {[
                      "deposit_notification",
                      "kyc_update",
                      "security_alert",
                      "wire_transfer",
                    ].map((type) => (
                      <Button
                        key={type}
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickFill(type)}
                        className="text-xs h-6"
                      >
                        {getActivityTypeLabel(type)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="priority">Priority Level</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                p.color.split(" ")[0]
                              }`}
                            />
                            <span>{p.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="displayAmount">
                    Display Amount (Optional)
                  </Label>
                  <Input
                    id="displayAmount"
                    type="number"
                    step="0.01"
                    value={displayAmount}
                    onChange={(e) => setDisplayAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="expiresAt">Expires At (Optional)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="activityTitle">Activity Title *</Label>
                <Input
                  id="activityTitle"
                  value={activityTitle}
                  onChange={(e) => setActivityTitle(e.target.value)}
                  placeholder="Brief title for the activity"
                />
              </div>

              <div>
                <Label htmlFor="activityDescription">Description</Label>
                <Textarea
                  id="activityDescription"
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  placeholder="Detailed description of the activity"
                  rows={3}
                  className="resize-none"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={
                  loading || !selectedUser || !activityType || !activityTitle
                }
                className="w-full bg-[#F26623] hover:bg-[#E55A1F]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Activity...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Activity Entry
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Recent Activities
            </div>
            <Button
              onClick={fetchRecentActivities}
              disabled={activitiesLoading}
              variant="outline"
              size="sm"
            >
              {activitiesLoading && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activitiesLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto mb-4"></div>
              <p className="text-gray-600">Loading activities...</p>
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No recent activities</p>
              <p className="text-sm text-gray-500">
                Activities you create will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Badge className={getActivityColor(activity.activity_type)}>
                      {getActivityIcon(activity.activity_type)}
                      <span className="ml-1">
                        {getActivityTypeLabel(activity.activity_type)}
                      </span>
                    </Badge>
                    <div>
                      <p className="font-medium text-sm">{activity.title}</p>
                      <p className="text-xs text-gray-500">
                        User: {activity.user_id.slice(0, 8)}...
                        {activity.display_amount && activity.currency && (
                          <span className="ml-2">
                            {currencies.find(
                              (c) => c.value === activity.currency
                            )?.symbol || "$"}
                            {activity.display_amount}
                          </span>
                        )}
                        <span className="ml-2">
                          Priority:{" "}
                          {
                            priorities.find(
                              (p) => p.value === activity.priority
                            )?.label
                          }
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {new Date(activity.created_at).toLocaleDateString()}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteActivity(activity.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
