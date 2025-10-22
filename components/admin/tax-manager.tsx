/*
  Tax Manager - Simple Three Column Management
  Only manages: taxes (amount), on_hold (amount), paid (amount)
*/

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Calculator,
  Loader2,
  CheckCircle,
  Search,
  X,
  Plus,
  Edit,
  Save,
  Shield,
  Crown,
  UserCheck,
  AlertTriangle,
  Clock,
  Pause,
  DollarSign,
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

interface SimpleTax {
  id: string;
  user_id: string;
  taxes: number;
  on_hold: number;
  paid: number;
  created_at: string;
  updated_at: string;
}

interface CurrentAdmin {
  id: string;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
}

export default function TaxManager() {
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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );

  // Tax data
  const [userTaxData, setUserTaxData] = useState<SimpleTax | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState({
    taxes: "",
    on_hold: "",
    paid: "",
  });

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
      return "Full Administrator - Can manage taxes for all users";
    }
    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      return "Superior Manager - Can manage taxes for assigned managers and their users";
    }
    if (currentAdmin.is_manager) {
      return "Manager - Can manage taxes for assigned users only";
    }
    return "No admin permissions";
  }, [currentAdmin]);

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
            "id, email, full_name, is_admin, is_manager, is_superiormanager"
          )
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
            client_id: `DCB${user.id.slice(0, 6)}`,
            full_name: user.full_name || user.email?.split("@")[0] || "Unknown",
            email: user.email,
            is_admin: user.is_admin || false,
            is_manager: user.is_manager || false,
            is_superiormanager: user.is_superiormanager || false,
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

  const fetchTaxData = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("taxes")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching tax data:", error);
        return;
      }

      if (data) {
        setUserTaxData(data);
        setEditValues({
          taxes: data.taxes.toString(),
          on_hold: data.on_hold.toString(),
          paid: data.paid.toString(),
        });
      } else {
        setUserTaxData({
          id: "",
          user_id: userId,
          taxes: 0,
          on_hold: 0,
          paid: 0,
          created_at: "",
          updated_at: "",
        });
        setEditValues({ taxes: "0", on_hold: "0", paid: "0" });
      }
    } catch (error) {
      console.error("Failed to fetch tax data:", error);
    }
  }, []);

  const saveTaxData = useCallback(async () => {
    if (!selectedUser || !currentAdmin) return;

    const canManageTaxes =
      accessibleUserIds.length === 0 ||
      accessibleUserIds.includes(selectedUser.id);

    if (!canManageTaxes) {
      setMessage({
        type: "error",
        text: "You don't have permission to manage taxes for this user",
      });
      return;
    }

    setLoading(true);
    try {
      const taxData = {
        user_id: selectedUser.id,
        taxes: parseFloat(editValues.taxes) || 0,
        on_hold: parseFloat(editValues.on_hold) || 0,
        paid: parseFloat(editValues.paid) || 0,
        updated_at: new Date().toISOString(),
      };

      // ✅ UPSERT ensures we don't duplicate rows
      const { error } = await supabase
        .from("taxes")
        .upsert(taxData, { onConflict: "user_id" });

      if (error) throw error;

      setMessage({
        type: "success",
        text: `Tax data updated successfully for ${
          selectedUser.full_name || selectedUser.email
        }`,
      });

      setEditMode(false);
      await new Promise((r) => setTimeout(r, 300)); // small delay
      await fetchTaxData(selectedUser.id);
    } catch (error: any) {
      console.error("Error saving tax data:", error);
      setMessage({
        type: "error",
        text: `Error: ${error.message || "Failed to save tax data"}`,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedUser, currentAdmin, accessibleUserIds, editValues, fetchTaxData]);

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

  // Format currency
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  }, []);

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
          setMessage({
            type: "error",
            text: "Failed to load admin permissions",
          });
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

  // EFFECT 3: Fetch tax data when user is selected
  useEffect(() => {
    if (selectedUser) {
      fetchTaxData(selectedUser.id);
    } else {
      setUserTaxData(null);
      setEditValues({ taxes: "0", on_hold: "0", paid: "0" });
    }
  }, [selectedUser, fetchTaxData]);

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
            You need admin or manager permissions to manage taxes.
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
      {/* Admin Level Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Your Access Level - Tax Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            {currentAdmin.is_admin &&
              !currentAdmin.is_superiormanager &&
              !currentAdmin.is_manager && (
                <Badge className="bg-red-100 text-red-800">
                  <Shield className="w-3 h-3 mr-1" />
                  Full Administrator
                </Badge>
              )}
            {currentAdmin.is_admin && currentAdmin.is_superiormanager && (
              <Badge className="bg-purple-100 text-purple-800">
                <Crown className="w-3 h-3 mr-1" />
                Superior Manager
              </Badge>
            )}
            {currentAdmin.is_manager && (
              <Badge className="bg-blue-100 text-blue-800">
                <UserCheck className="w-3 h-3 mr-1" />
                Manager
              </Badge>
            )}
            <span className="text-sm text-gray-600">
              {getAdminLevelDescription}
            </span>
          </div>
        </CardContent>
      </Card>

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
          <CardTitle className="flex items-center">
            <Calculator className="w-5 h-5 mr-2" />
            Simple Tax Management - Three Categories Only
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Search */}
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
                    setUserTaxData(null);
                    setEditMode(false);
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
                        You can only manage taxes for users specifically
                        assigned to you
                      </p>
                    )}
                    {currentAdmin.is_admin &&
                      currentAdmin.is_superiormanager && (
                        <p className="text-xs text-blue-600 mt-1">
                          You can manage taxes for managers you assigned and
                          their users
                        </p>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tax Management Interface */}
          {selectedUser && userTaxData && (
            <div className="space-y-6 border-t pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center">
                  <Calculator className="w-5 h-5 mr-2" />
                  Tax Data for {selectedUser.full_name || selectedUser.email}
                </h3>
                <div className="flex space-x-2">
                  {!editMode ? (
                    <Button
                      onClick={() => setEditMode(true)}
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => {
                          setEditMode(false);
                          if (userTaxData) {
                            setEditValues({
                              taxes: userTaxData.taxes.toString(),
                              on_hold: userTaxData.on_hold.toString(),
                              paid: userTaxData.paid.toString(),
                            });
                          }
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={saveTaxData}
                        disabled={loading}
                        size="sm"
                        className="bg-[#F26623] hover:bg-[#E55A1F]"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Save
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Three Categories Display/Edit */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Taxes (Amount Owed) */}
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center text-yellow-700">
                      <Clock className="w-5 h-5 mr-2" />
                      Taxes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {editMode ? (
                      <div className="space-y-2">
                        <Label htmlFor="taxes">Amount Owed ($)</Label>
                        <Input
                          id="taxes"
                          type="number"
                          step="0.01"
                          value={editValues.taxes}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              taxes: e.target.value,
                            })
                          }
                          className="font-mono"
                        />
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <DollarSign className="w-6 h-6 text-yellow-600" />
                        </div>
                        <p className="text-2xl font-bold text-yellow-700">
                          {formatCurrency(userTaxData.taxes)}
                        </p>
                        <p className="text-sm text-yellow-600">Amount Owed</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* On Hold (Amount) */}
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center text-blue-700">
                      <Pause className="w-5 h-5 mr-2" />
                      On Hold
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {editMode ? (
                      <div className="space-y-2">
                        <Label htmlFor="on_hold">Amount On Hold ($)</Label>
                        <Input
                          id="on_hold"
                          type="number"
                          step="0.01"
                          value={editValues.on_hold}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              on_hold: e.target.value,
                            })
                          }
                          className="font-mono"
                        />
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Pause className="w-6 h-6 text-blue-600" />
                        </div>
                        <p className="text-2xl font-bold text-blue-700">
                          {formatCurrency(userTaxData.on_hold)}
                        </p>
                        <p className="text-sm text-blue-600">On Hold</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Paid (Amount) */}
                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center text-green-700">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Paid Taxes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {editMode ? (
                      <div className="space-y-2">
                        <Label htmlFor="paid">Amount Paid ($)</Label>
                        <Input
                          id="paid"
                          type="number"
                          step="0.01"
                          value={editValues.paid}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              paid: e.target.value,
                            })
                          }
                          className="font-mono"
                        />
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <p className="text-2xl font-bold text-green-700">
                          {formatCurrency(userTaxData.paid)}
                        </p>
                        <p className="text-sm text-green-600">Total Paid</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Summary */}
              {!editMode && (
                <Card className="bg-gray-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Tax Summary
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                          Total Outstanding:{" "}
                          {formatCurrency(
                            userTaxData.taxes + userTaxData.on_hold
                          )}
                        </p>
                        <p className="text-sm text-gray-600">
                          Paid to Date: {formatCurrency(userTaxData.paid)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Last Updated</p>
                        <p className="text-sm font-medium">
                          {userTaxData.updated_at
                            ? new Date(
                                userTaxData.updated_at
                              ).toLocaleDateString()
                            : "Never"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
