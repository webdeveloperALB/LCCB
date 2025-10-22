"use client";

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  RefreshCw,
  DollarSign,
  Euro,
  Bitcoin,
  Search,
  Calendar,
  Shield,
  Loader2,
  Crown,
  UserCheck,
  UserPlus,
  UserMinus,
  Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  email: string;
  password: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  kyc_status: string;
  client_id: string;
  display_name: string;
  age: number | null;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
}

interface UserBalance {
  user_id: string;
  crypto: number;
  euro: number;
  cad: number;
  usd: number;
}

interface UserAssignment {
  id: string;
  manager_id: string;
  assigned_user_id: string;
  assigned_by: string;
  created_at: string;
}

interface CurrentAdmin {
  id: string;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
}

export default function UserManagement() {
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userBalances, setUserBalances] = useState<UserBalance[]>([]);
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedManager, setSelectedManager] = useState<string>("");
  const [showAssignmentInterface, setShowAssignmentInterface] = useState(false);

  // Get current admin info
  const getCurrentAdmin = useCallback(async () => {
    try {
      // Get current session from localStorage (matches your login system)
      const currentSession = localStorage.getItem("current_admin_session");
      if (!currentSession) {
        console.log("No current admin session found");
        return null;
      }

      const sessionData = JSON.parse(currentSession);
      console.log("Current session data:", sessionData);

      // Get admin info from users table using session user ID
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

  // Check if user has full admin access (is_admin: true, others: false)
  const hasFullAdminAccess = () => {
    return (
      currentAdmin?.is_admin === true &&
      currentAdmin?.is_manager === false &&
      currentAdmin?.is_superiormanager === false
    );
  };

  // Get accessible user IDs based on hierarchy
  const getAccessibleUserIds = useCallback(
    async (admin: CurrentAdmin): Promise<string[]> => {
      if (!admin) {
        console.log("No admin provided to getAccessibleUserIds");
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
            return [];
          }

          const managerIds =
            managerAssignments?.map((a) => a.assigned_user_id) || [];
          console.log("Superior manager's assigned managers:", managerIds);

          if (managerIds.length > 0) {
            // Get users assigned to those managers
            const { data: userAssignments, error: userError } = await supabase
              .from("user_assignments")
              .select("assigned_user_id")
              .in("manager_id", managerIds);

            if (userError) {
              console.error("Error fetching user assignments:", userError);
              return managerIds; // At least return the managers
            }

            const userIds =
              userAssignments?.map((a) => a.assigned_user_id) || [];
            const accessibleIds = [...managerIds, ...userIds];
            console.log("Superior manager can access:", accessibleIds);
            return accessibleIds;
          }
          console.log("Superior manager has no assigned managers");
          return [];
        } catch (error) {
          console.error("Error in superior manager logic:", error);
          return [];
        }
      }

      // Manager (is_manager: true) - can only see assigned users
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
            return [];
          }

          const accessibleIds =
            userAssignments?.map((a) => a.assigned_user_id) || [];
          console.log("Manager can access users:", accessibleIds);
          return accessibleIds;
        } catch (error) {
          console.error("Error in manager logic:", error);
          return [];
        }
      }

      console.log("No valid admin role found");
      return [];
    },
    []
  );

  // Fetch balances for a user
  const fetchUserBalance = async (userId: string): Promise<UserBalance> => {
    try {
      const [cryptoResult, euroResult, cadResult, usdResult] =
        await Promise.allSettled([
          supabase
            .from("crypto_balances")
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
            .from("usd_balances")
            .select("balance")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

      return {
        user_id: userId,
        crypto:
          cryptoResult.status === "fulfilled"
            ? Number(cryptoResult.value?.data?.balance || 0)
            : 0,
        euro:
          euroResult.status === "fulfilled"
            ? Number(euroResult.value?.data?.balance || 0)
            : 0,
        cad:
          cadResult.status === "fulfilled"
            ? Number(cadResult.value?.data?.balance || 0)
            : 0,
        usd:
          usdResult.status === "fulfilled"
            ? Number(usdResult.value?.data?.balance || 0)
            : 0,
      };
    } catch (error) {
      console.error(`Balance fetch failed for user ${userId}:`, error);
      return {
        user_id: userId,
        crypto: 0,
        euro: 0,
        cad: 0,
        usd: 0,
      };
    }
  };

  // Load users based on current admin's permissions
  const loadNewestUsers = useCallback(async () => {
    if (!currentAdmin) {
      console.log("No current admin, cannot load users");
      return;
    }

    setLoading(true);
    setUsers([]);
    setUserBalances([]);
    setIsSearchMode(false);
    setMessage(null);

    try {
      console.log("Loading users for admin:", currentAdmin);

      let query = supabase
        .from("users")
        .select(
          "id, email, password, full_name, first_name, last_name, created_at, kyc_status, age, is_admin, is_manager, is_superiormanager"
        );

      // Apply hierarchy-based filtering
      const accessibleUserIds = await getAccessibleUserIds(currentAdmin);

      if (accessibleUserIds.length > 0) {
        console.log("Filtering to accessible user IDs:", accessibleUserIds);
        query = query.in("id", accessibleUserIds);
      } else if (
        currentAdmin.is_admin &&
        !currentAdmin.is_superiormanager &&
        !currentAdmin.is_manager
      ) {
        // Full admin sees everyone - no filter needed
        console.log("Full admin - no filter applied");
      } else {
        // No accessible users
        console.log("No accessible users for this admin");
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      }

      const { data: userData, error: userError } = await query
        .order("created_at", { ascending: false })
        .limit(5);

      if (userError) throw userError;

      const transformedUsers: User[] = (userData || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at,
        kyc_status: user.kyc_status || "not_started",
        age: user.age,
        is_admin: user.is_admin || false,
        is_manager: user.is_manager || false,
        is_superiormanager: user.is_superiormanager || false,
        client_id: `DCB${user.id.slice(0, 6)}`,
        password: user.password || "",
        display_name:
          user.full_name ||
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.email?.split("@")[0] ||
          "Unknown User",
      }));

      setUsers(transformedUsers);

      // Fetch balances for all users
      const balancePromises = transformedUsers.map((user) =>
        fetchUserBalance(user.id)
      );
      const balances = await Promise.all(balancePromises);
      setUserBalances(balances);
    } catch (error) {
      console.error("Failed to load users:", error);
      setMessage({
        type: "error",
        text: "Failed to load users. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [currentAdmin, getAccessibleUserIds]);

  // Search users in database with hierarchy filtering
  const searchUsers = useCallback(async () => {
    if (!currentAdmin) {
      console.log("No current admin, cannot search users");
      return;
    }

    if (!searchTerm.trim()) {
      loadNewestUsers();
      return;
    }

    setSearchLoading(true);
    setUsers([]);
    setUserBalances([]);
    setIsSearchMode(true);
    setMessage(null);

    try {
      const searchLower = searchTerm.toLowerCase();

      let query = supabase
        .from("users")
        .select(
          "id, email, password, full_name, first_name, last_name, created_at, kyc_status, age, is_admin, is_manager, is_superiormanager"
        );

      // Apply hierarchy-based filtering
      const accessibleUserIds = await getAccessibleUserIds(currentAdmin);

      console.log("Searching users with accessible IDs:", accessibleUserIds);

      if (accessibleUserIds.length > 0) {
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
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      }

      const { data: userData, error: userError } = await query
        .or(
          `email.ilike.%${searchLower}%,full_name.ilike.%${searchLower}%,first_name.ilike.%${searchLower}%,last_name.ilike.%${searchLower}%`
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (userError) throw userError;

      const transformedUsers: User[] = (userData || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at,
        kyc_status: user.kyc_status || "not_started",
        age: user.age,
        is_admin: user.is_admin || false,
        is_manager: user.is_manager || false,
        is_superiormanager: user.is_superiormanager || false,
        client_id: `DCB${user.id.slice(0, 6)}`,
        password: user.password,
        display_name:
          user.full_name ||
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.email?.split("@")[0] ||
          "Unknown User",
      }));

      setUsers(transformedUsers);

      if (transformedUsers.length > 0) {
        // Fetch balances for search results
        const balancePromises = transformedUsers.map((user) =>
          fetchUserBalance(user.id)
        );
        const balances = await Promise.all(balancePromises);
        setUserBalances(balances);
      }

      setMessage({
        type: "success",
        text: `Found ${transformedUsers.length} users matching "${searchTerm}"`,
      });
    } catch (error) {
      console.error("Search failed:", error);
      setMessage({
        type: "error",
        text: "Search failed. Please try again.",
      });
    } finally {
      setSearchLoading(false);
    }
  }, [searchTerm, loadNewestUsers, currentAdmin, getAccessibleUserIds]);

  // Load assignments
  const loadAssignments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("user_assignments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error("Failed to load assignments:", error);
    }
  }, []);

  // Assign user to manager
  const assignUserToManager = async () => {
    if (!selectedUser || !selectedManager || !currentAdmin) return;

    setActionLoading(true);
    try {
      // Check permissions
      const canAssign = await checkAssignmentPermissions(
        selectedManager,
        selectedUser
      );
      if (!canAssign) {
        setMessage({
          type: "error",
          text: "You don't have permission to make this assignment",
        });
        return;
      }

      const { error } = await supabase.from("user_assignments").insert({
        manager_id: selectedManager,
        assigned_user_id: selectedUser,
        assigned_by: currentAdmin.id,
      });

      if (error) throw error;

      setMessage({ type: "success", text: "User assigned successfully" });
      setSelectedUser("");
      setSelectedManager("");
      await loadAssignments();
      await loadNewestUsers();
    } catch (error) {
      console.error("Assignment failed:", error);
      setMessage({ type: "error", text: "Failed to assign user" });
    } finally {
      setActionLoading(false);
    }
  };

  // Remove assignment
  const removeAssignment = async (assignmentId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("user_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      setMessage({ type: "success", text: "Assignment removed successfully" });
      await loadAssignments();
      await loadNewestUsers();
    } catch (error) {
      console.error("Failed to remove assignment:", error);
      setMessage({ type: "error", text: "Failed to remove assignment" });
    } finally {
      setActionLoading(false);
    }
  };

  // Update user role
  const updateUserRole = async (
    userId: string,
    roleType: string,
    value: boolean
  ) => {
    if (!currentAdmin) return;

    setActionLoading(true);
    try {
      // Check permissions
      if (!canModifyUserRole(userId, roleType)) {
        setMessage({
          type: "error",
          text: "You don't have permission to modify this user's role",
        });
        return;
      }

      // Prepare update object
      const updateData: any = { [roleType]: value };

      // Auto-assign admin role when making someone a manager or superior manager
      if (
        (roleType === "is_manager" || roleType === "is_superiormanager") &&
        value === true
      ) {
        updateData.is_admin = true;
      }

      // When removing manager role, check if they should lose admin access
      if (roleType === "is_manager" && value === false) {
        const user = users.find((u) => u.id === userId);
        if (user && !user.is_superiormanager) {
          // Only remove admin if they're not a superior manager
          updateData.is_admin = false;
        }
      }

      // When removing superior manager role, check if they should lose admin access
      if (roleType === "is_superiormanager" && value === false) {
        const user = users.find((u) => u.id === userId);
        if (user && !user.is_manager) {
          // Only remove admin if they're not a regular manager
          updateData.is_admin = false;
        }
      }

      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", userId);

      if (error) throw error;

      const roleDescription =
        roleType === "is_manager"
          ? "Manager"
          : roleType === "is_superiormanager"
          ? "Superior Manager"
          : "Admin";
      const action = value ? "promoted to" : "removed from";

      setMessage({
        type: "success",
        text: `User ${action} ${roleDescription} role successfully${
          (roleType === "is_manager" || roleType === "is_superiormanager") &&
          value
            ? " (Admin access granted automatically)"
            : ""
        }`,
      });
      await loadNewestUsers();
    } catch (error) {
      console.error("Failed to update role:", error);
      setMessage({ type: "error", text: "Failed to update user role" });
    } finally {
      setActionLoading(false);
    }
  };

  // Check if current admin can assign a user to a manager
  const checkAssignmentPermissions = async (
    managerId: string,
    userId: string
  ): Promise<boolean> => {
    if (!currentAdmin) return false;

    // Full admin can assign anyone
    if (currentAdmin.is_admin && !currentAdmin.is_superiormanager) {
      return true;
    }

    // Superior manager can only assign to managers they control
    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      const { data: managerAssignment } = await supabase
        .from("user_assignments")
        .select("id")
        .eq("manager_id", currentAdmin.id)
        .eq("assigned_user_id", managerId)
        .single();

      return !!managerAssignment;
    }

    // Regular managers can assign users to themselves only
    if (currentAdmin.is_manager) {
      return managerId === currentAdmin.id;
    }

    return false;
  };

  // Check if current admin can modify a user's role
  const canModifyUserRole = (userId: string, roleType: string): boolean => {
    if (!currentAdmin) return false;

    // Full admin can modify anyone
    if (currentAdmin.is_admin && !currentAdmin.is_superiormanager) {
      return true;
    }

    // Superior manager can only modify manager role for users they control
    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      return roleType === "is_manager";
    }

    // Regular managers cannot modify roles
    return false;
  };

  // Get users that can be assigned to managers
  const getAssignableUsers = () => {
    if (!currentAdmin) return [];

    if (currentAdmin.is_admin && !currentAdmin.is_superiormanager) {
      // Full admin can assign anyone
      return users.filter((u) => !u.is_admin);
    }

    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      // Superior manager can assign users to their managers
      const myManagers = assignments
        .filter((a) => a.manager_id === currentAdmin.id)
        .map((a) => a.assigned_user_id);

      return users.filter(
        (u) => !u.is_admin && !u.is_manager && !myManagers.includes(u.id)
      );
    }

    if (currentAdmin.is_manager) {
      // Manager can assign unassigned users to themselves
      const assignedUserIds = assignments.map((a) => a.assigned_user_id);
      return users.filter(
        (u) => !u.is_admin && !u.is_manager && !assignedUserIds.includes(u.id)
      );
    }

    return [];
  };

  // Get managers that can receive assignments
  const getAvailableManagers = () => {
    if (!currentAdmin) return [];

    if (currentAdmin.is_admin && !currentAdmin.is_superiormanager) {
      // Full admin can assign to any manager
      return users.filter((u) => u.is_manager);
    }

    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      // Superior manager can assign to their managers
      const myManagers = assignments
        .filter((a) => a.manager_id === currentAdmin.id)
        .map((a) => a.assigned_user_id);

      return users.filter((u) => myManagers.includes(u.id));
    }

    if (currentAdmin.is_manager) {
      // Manager can only assign to themselves
      return users.filter((u) => u.id === currentAdmin.id);
    }

    return [];
  };

  // Initialize current admin
  useEffect(() => {
    const init = async () => {
      const admin = await getCurrentAdmin();
      setCurrentAdmin(admin);
    };
    init();
  }, [getCurrentAdmin]);

  // Load newest users on component mount
  useEffect(() => {
    if (currentAdmin) {
      loadNewestUsers();
      loadAssignments();
    }
  }, [currentAdmin, loadNewestUsers, loadAssignments]);

  // Filter users based on search
  const filteredUsers = users.filter(
    (user) =>
      user.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getUserBalance = (userId: string) => {
    return (
      userBalances.find((balance) => balance.user_id === userId) || {
        crypto: 0,
        euro: 0,
        cad: 0,
        usd: 0,
      }
    );
  };

  const getKycStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getKycStatusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return "Verified";
      case "pending":
        return "Pending";
      case "rejected":
        return "Rejected";
      case "not_started":
        return "Not Started";
      default:
        return "Unknown";
    }
  };

  const getRoleBadges = (user: User) => {
    const roles = [];
    if (user.is_superiormanager) roles.push("Superior Manager");
    else if (user.is_manager) roles.push("Manager");
    if (user.is_admin) roles.push("Admin");
    return roles;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchUsers();
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    loadNewestUsers();
  };

  // Get admin level description
  const getAdminLevelDescription = () => {
    if (!currentAdmin) return "Loading permissions...";

    if (currentAdmin.is_admin && !currentAdmin.is_superiormanager) {
      return "Full Administrator - Can view and manage all users";
    }
    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      return "Superior Manager - Can manage assigned managers and their users";
    }
    if (currentAdmin.is_manager) {
      return "Manager - Can view and manage assigned users only";
    }
    return "No admin permissions";
  };

  const assignableUsers = getAssignableUsers();
  const availableManagers = getAvailableManagers();

  if (!currentAdmin) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin permissions...</p>
        </CardContent>
      </Card>
    );
  }

  // Check if user has access to this component
  if (!hasFullAdminAccess()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <Shield className="w-5 h-5 mr-2" />
            Access Restricted
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Full Administrator Access Required
          </h3>
          <p className="text-gray-600 mb-4">
            This section is only accessible to Full Administrators.
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
            <p className="mt-4 text-xs">
              Required: Admin = Yes, Manager = No, Superior = No
            </p>
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
            Your Access Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            {currentAdmin.is_admin && !currentAdmin.is_superiormanager && (
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
            {currentAdmin.is_manager && !currentAdmin.is_admin && (
              <Badge className="bg-blue-100 text-blue-800">
                <UserCheck className="w-3 h-3 mr-1" />
                Manager
              </Badge>
            )}
            <span className="text-sm text-gray-600">
              {getAdminLevelDescription()}
            </span>
          </div>
        </CardContent>
      </Card>
      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              User Management
              <Badge variant="outline" className="ml-3">
                {isSearchMode ? "Search Results" : "5 Newest"}
              </Badge>
            </div>
            <Button
              onClick={loadNewestUsers}
              disabled={loading || searchLoading}
              variant="outline"
              size="sm"
            >
              <Loader2
                className={`w-4 h-4 mr-2 ${
                  loading ? "animate-spin" : "hidden"
                }`}
              />
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "hidden" : ""}`}
              />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {message && (
            <Alert
              className={`mb-4 ${
                message.type === "error"
                  ? "border-red-500 bg-red-50"
                  : "border-green-500 bg-green-50"
              }`}
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

          {/* Search Section */}
          <div className="mb-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search by name, email, or client ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={searchUsers}
                disabled={searchLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Loader2
                  className={`w-4 h-4 mr-2 ${
                    searchLoading ? "animate-spin" : "hidden"
                  }`}
                />
                <Search
                  className={`w-4 h-4 mr-2 ${searchLoading ? "hidden" : ""}`}
                />
                Search
              </Button>
              {isSearchMode && (
                <Button onClick={clearSearch} variant="outline">
                  Clear
                </Button>
              )}
            </div>
          </div>

          {loading || searchLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">
                {searchLoading ? "Searching users..." : "Loading users..."}
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">
                {isSearchMode ? "No users found" : "No accessible users"}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {isSearchMode
                  ? `No results found for "${searchTerm}"`
                  : "No users available based on your permissions"}
              </p>
              {!isSearchMode && (
                <Button
                  onClick={loadNewestUsers}
                  className="bg-[#F26623] hover:bg-[#E55A1F]"
                >
                  Refresh Users
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats */}
              <div className="flex items-center gap-4 mb-4">
                <h3 className="text-lg font-semibold">
                  {isSearchMode ? "Search Results" : "Showing 5 Newest Users"}
                </h3>
              </div>

              {/* User Grid */}
              <div className="grid grid-cols-1 gap-4">
                {users.map((user) => {
                  const balance = getUserBalance(user.id);
                  const roles = getRoleBadges(user);
                  const userAssignment = assignments.find(
                    (a) => a.assigned_user_id === user.id
                  );

                  return (
                    <div
                      key={user.id}
                      className="border rounded-lg p-4 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h4 className="font-medium text-lg">
                              {user.display_name}
                            </h4>
                            <Badge
                              className={getKycStatusColor(user.kyc_status)}
                            >
                              <Shield className="w-3 h-3 mr-1" />
                              {getKycStatusLabel(user.kyc_status)}
                            </Badge>
                            {roles.map((role) => (
                              <Badge
                                key={role}
                                variant="secondary"
                                className="bg-purple-100 text-purple-800"
                              >
                                {role}
                              </Badge>
                            ))}
                            {userAssignment && (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-800"
                              >
                                Assigned User
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-600">
                            <p>
                              <span className="font-medium">Client ID:</span>{" "}
                              {user.client_id}
                            </p>
                            <p>
                              <span className="font-medium">Email:</span>{" "}
                              {user.email}
                            </p>
                            <p>
                              <span className="font-medium">Password:</span>{" "}
                              <span className="text-gray-800">
                                {user.password || "N/A"}
                              </span>
                            </p>
                            <p className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              <span className="font-medium">Joined:</span>{" "}
                              {formatDate(user.created_at)}
                            </p>
                            {user.age && (
                              <p>
                                <span className="font-medium">Age:</span>{" "}
                                {user.age}
                              </p>
                            )}
                          </div>

                          {/* Assignment Info */}
                          {userAssignment && (
                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                              <p className="text-xs text-blue-700">
                                <span className="font-medium">Assignment:</span>{" "}
                                Assigned on{" "}
                                {formatDate(userAssignment.created_at)}
                              </p>
                              {userAssignment.manager_id !==
                                currentAdmin?.id && (
                                <p className="text-xs text-blue-600">
                                  Managed by another manager in your hierarchy
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Role Management Actions */}
                        <div className="flex flex-col space-y-2">
                          {canModifyUserRole(user.id, "is_manager") && (
                            <div className="flex space-x-2">
                              {!user.is_manager && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateUserRole(user.id, "is_manager", true)
                                  }
                                  disabled={actionLoading}
                                  className="text-blue-600 hover:bg-blue-50"
                                >
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  Make Manager
                                </Button>
                              )}
                              {user.is_manager && !user.is_admin && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateUserRole(user.id, "is_manager", false)
                                  }
                                  disabled={actionLoading}
                                  className="text-red-600 hover:bg-red-50"
                                >
                                  <UserMinus className="w-3 h-3 mr-1" />
                                  Remove Manager
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Assignment Removal */}
                          {userAssignment &&
                            userAssignment.manager_id === currentAdmin?.id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  removeAssignment(userAssignment.id)
                                }
                                disabled={actionLoading}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <UserMinus className="w-3 h-3 mr-1" />
                                Unassign
                              </Button>
                            )}
                        </div>
                      </div>

                      {/* Balance Section */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-600 font-medium">
                                Crypto
                              </p>
                              <p className="font-bold text-lg text-orange-700">
                                {balance.crypto.toFixed(8)}
                              </p>
                              <p className="text-xs text-gray-500">BTC</p>
                            </div>
                            <Bitcoin className="w-5 h-5 text-orange-500" />
                          </div>
                        </div>

                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-600 font-medium">
                                Euro
                              </p>
                              <p className="font-bold text-lg text-blue-700">
                                €{balance.euro.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500">EUR</p>
                            </div>
                            <Euro className="w-5 h-5 text-blue-500" />
                          </div>
                        </div>

                        <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-600 font-medium">
                                Canadian
                              </p>
                              <p className="font-bold text-lg text-green-700">
                                C${balance.cad.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500">CAD</p>
                            </div>
                            <DollarSign className="w-5 h-5 text-green-500" />
                          </div>
                        </div>

                        <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-600 font-medium">
                                US Dollar
                              </p>
                              <p className="font-bold text-lg text-purple-700">
                                ${balance.usd.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500">USD</p>
                            </div>
                            <DollarSign className="w-5 h-5 text-purple-500" />
                          </div>
                        </div>
                      </div>

                      {/* Total Portfolio Value */}
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 font-medium">
                            Total Portfolio Value:
                          </span>
                          <span className="font-bold text-gray-900">
                            $
                            {(
                              balance.usd +
                              balance.cad +
                              balance.euro * 1.1 +
                              balance.crypto * 50000
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {isSearchMode && users.length === 0 && searchTerm && (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">
                    No users found matching "{searchTerm}"
                  </p>
                  <p className="text-sm text-gray-500">
                    Try searching by name, email, or different keywords
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
