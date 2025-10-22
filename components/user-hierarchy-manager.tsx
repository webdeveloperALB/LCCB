"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  Shield,
  Crown,
  UserCheck,
  UserPlus,
  UserMinus,
  Search,
  ChevronDown,
  ChevronRight,
  Settings,
  AlertTriangle,
  Loader2,
} from "lucide-react";
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
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  kyc_status: string;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
  display_name: string;
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

export default function UserHierarchyManager() {
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedManager, setSelectedManager] = useState<string>("");
  const [selectedManagerForSuperior, setSelectedManagerForSuperior] =
    useState<string>("");
  const [selectedSuperiorManager, setSelectedSuperiorManager] =
    useState<string>("");
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(
    new Set()
  );
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);

  // Check if user has full admin access (is_admin: true, others: false)
  const hasFullAdminAccess = () => {
    return (
      currentAdmin?.is_admin === true &&
      currentAdmin?.is_manager === false &&
      currentAdmin?.is_superiormanager === false
    );
  };

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

  // Load users based on current admin's permissions
  const loadUsers = useCallback(async () => {
    if (!currentAdmin) return;

    setLoading(true);
    try {
      console.log("Loading users for admin:", currentAdmin);

      let query = supabase
        .from("users")
        .select(
          "id, email, full_name, first_name, last_name, created_at, kyc_status, is_admin, is_manager, is_superiormanager"
        );

      // Apply hierarchy filters
      if (currentAdmin.is_admin && !currentAdmin.is_superiormanager) {
        // Full admin - can see everyone (limited to 15 newest)
        console.log("Full admin - loading 15 newest users");
        query = query.order("created_at", { ascending: false }).limit(15);
      } else if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
        // Superior manager - can only see managers they assigned and their users
        console.log(
          "Superior manager - loading assigned managers and their users"
        );
        const { data: managerAssignments } = await supabase
          .from("user_assignments")
          .select("assigned_user_id")
          .eq("manager_id", currentAdmin.id);

        console.log("Manager assignments:", managerAssignments);

        const { data: userAssignments } = await supabase
          .from("user_assignments")
          .select("assigned_user_id, manager_id")
          .in(
            "manager_id",
            managerAssignments?.map((a) => a.assigned_user_id) || []
          );

        console.log("User assignments:", userAssignments);

        const accessibleUserIds = [
          ...(managerAssignments?.map((a) => a.assigned_user_id) || []),
          ...(userAssignments?.map((a) => a.assigned_user_id) || []),
        ];

        console.log("Superior manager accessible user IDs:", accessibleUserIds);

        if (accessibleUserIds.length > 0) {
          query = query
            .in("id", accessibleUserIds)
            .order("created_at", { ascending: false })
            .limit(15);
        } else {
          console.log("No accessible users for superior manager");
          query = query.eq("id", "00000000-0000-0000-0000-000000000000"); // No results
        }
      } else if (currentAdmin.is_manager) {
        // Manager - can only see assigned users
        console.log("Manager - loading assigned users");
        const { data: userAssignments } = await supabase
          .from("user_assignments")
          .select("assigned_user_id")
          .eq("manager_id", currentAdmin.id);

        console.log("Manager's user assignments:", userAssignments);

        const accessibleUserIds =
          userAssignments?.map((a) => a.assigned_user_id) || [];

        if (accessibleUserIds.length > 0) {
          query = query
            .in("id", accessibleUserIds)
            .order("created_at", { ascending: false })
            .limit(15);
        } else {
          console.log("No assigned users for manager");
          query = query.eq("id", "00000000-0000-0000-0000-000000000000"); // No results
        }
      }

      const { data: userData, error } = await query;

      if (error) throw error;

      const transformedUsers: User[] = (userData || []).map((user: any) => ({
        ...user,
        display_name:
          user.full_name ||
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.email?.split("@")[0] ||
          "Unknown User",
      }));

      setUsers(transformedUsers);
    } catch (error) {
      console.error("Failed to load users:", error);
      setMessage({ type: "error", text: "Failed to load users" });
    } finally {
      setLoading(false);
    }
  }, [currentAdmin]);

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
      await loadUsers();
    } catch (error) {
      console.error("Assignment failed:", error);
      setMessage({ type: "error", text: "Failed to assign user" });
    } finally {
      setActionLoading(false);
    }
  };

  // Assign manager to superior manager
  const assignManagerToSuperior = async () => {
    if (
      !selectedManagerForSuperior ||
      !selectedSuperiorManager ||
      !currentAdmin
    )
      return;

    setActionLoading(true);
    try {
      // Only full admin can assign managers to superior managers
      if (!hasFullAdminAccess()) {
        setMessage({
          type: "error",
          text: "Only full administrators can assign managers to superior managers",
        });
        return;
      }

      const { error } = await supabase.from("user_assignments").insert({
        manager_id: selectedSuperiorManager,
        assigned_user_id: selectedManagerForSuperior,
        assigned_by: currentAdmin.id,
      });

      if (error) throw error;

      setMessage({
        type: "success",
        text: "Manager assigned to superior manager successfully",
      });
      setSelectedManagerForSuperior("");
      setSelectedSuperiorManager("");
      await loadAssignments();
      await loadUsers();
    } catch (error) {
      console.error("Manager assignment failed:", error);
      setMessage({
        type: "error",
        text: "Failed to assign manager to superior manager",
      });
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
      await loadUsers();
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
      await loadUsers();
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

  // Get managers that can be assigned to superior managers
  const getAssignableManagers = () => {
    if (!currentAdmin) return [];

    // Only full admin can assign managers to superior managers
    if (currentAdmin.is_admin && !currentAdmin.is_superiormanager) {
      // Get managers that are not already assigned to any superior manager
      const assignedManagerIds = assignments
        .filter((a) => {
          const manager = users.find((u) => u.id === a.manager_id);
          return manager?.is_superiormanager;
        })
        .map((a) => a.assigned_user_id);

      return users.filter(
        (u) =>
          u.is_manager &&
          !u.is_superiormanager &&
          !assignedManagerIds.includes(u.id)
      );
    }

    return [];
  };

  // Get superior managers that can receive manager assignments
  const getAvailableSuperiorManagers = () => {
    if (!currentAdmin) return [];

    // Only full admin can assign managers to superior managers
    if (currentAdmin.is_admin && !currentAdmin.is_superiormanager) {
      return users.filter((u) => u.is_superiormanager);
    }

    return [];
  };

  // Handle user search for assignment
  const handleUserSearchChange = async (searchValue: string) => {
    setUserSearchTerm(searchValue);

    if (!searchValue.trim()) {
      // If search is empty, load default assignable users
      setUserSearchLoading(true);
      try {
        const { data: defaultUsers, error } = await supabase
          .from("users")
          .select(
            "id, email, full_name, first_name, last_name, created_at, kyc_status, is_admin, is_manager, is_superiormanager"
          )
          .eq("is_admin", false)
          .eq("is_manager", false)
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        const transformedUsers: User[] = (defaultUsers || []).map(
          (user: any) => ({
            ...user,
            display_name:
              user.full_name ||
              `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
              user.email?.split("@")[0] ||
              "Unknown User",
          })
        );

        setAllUsers(transformedUsers);
      } catch (error) {
        console.error("Failed to load default users:", error);
        setAllUsers([]);
      } finally {
        setUserSearchLoading(false);
      }
      return;
    }

    setUserSearchLoading(true);
    try {
      console.log("Searching all users for assignment:", searchValue);

      const searchLower = searchValue.toLowerCase();

      const { data: searchResults, error } = await supabase
        .from("users")
        .select(
          "id, email, full_name, first_name, last_name, created_at, kyc_status, is_admin, is_manager, is_superiormanager"
        )
        .or(
          `email.ilike.%${searchLower}%,full_name.ilike.%${searchLower}%,first_name.ilike.%${searchLower}%,last_name.ilike.%${searchLower}%`
        )
        .eq("is_admin", false) // Only non-admin users can be assigned
        .eq("is_manager", false) // Only non-manager users can be assigned
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const transformedResults: User[] = (searchResults || []).map(
        (user: any) => ({
          ...user,
          display_name:
            user.full_name ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            user.email?.split("@")[0] ||
            "Unknown User",
        })
      );

      setAllUsers(transformedResults);
      console.log(
        `Found ${transformedResults.length} users matching "${searchValue}"`
      );
    } catch (error) {
      console.error("User search failed:", error);
      setMessage({ type: "error", text: "Failed to search users" });
      setAllUsers([]);
    } finally {
      setUserSearchLoading(false);
    }
  };

  // Get user hierarchy display
  const getUserHierarchy = () => {
    const hierarchy: any = {};

    // Group assignments by manager
    assignments.forEach((assignment) => {
      if (!hierarchy[assignment.manager_id]) {
        const manager = users.find((u) => u.id === assignment.manager_id);
        hierarchy[assignment.manager_id] = {
          manager,
          assignedUsers: [],
        };
      }

      const assignedUser = users.find(
        (u) => u.id === assignment.assigned_user_id
      );
      if (assignedUser) {
        hierarchy[assignment.manager_id].assignedUsers.push({
          user: assignedUser,
          assignment,
        });
      }
    });

    return hierarchy;
  };

  // Toggle manager expansion
  const toggleManagerExpansion = (managerId: string) => {
    const newExpanded = new Set(expandedManagers);
    if (newExpanded.has(managerId)) {
      newExpanded.delete(managerId);
    } else {
      newExpanded.add(managerId);
    }
    setExpandedManagers(newExpanded);
  };

  // Initialize
  useEffect(() => {
    const init = async () => {
      const admin = await getCurrentAdmin();
      setCurrentAdmin(admin);

      // Load initial users for assignment search
      if (admin) {
        setUserSearchLoading(true);
        try {
          const { data: defaultUsers, error } = await supabase
            .from("users")
            .select(
              "id, email, full_name, first_name, last_name, created_at, kyc_status, is_admin, is_manager, is_superiormanager"
            )
            .eq("is_admin", false)
            .eq("is_manager", false)
            .order("created_at", { ascending: false })
            .limit(100);

          if (error) throw error;

          const transformedUsers: User[] = (defaultUsers || []).map(
            (user: any) => ({
              ...user,
              display_name:
                user.full_name ||
                `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
                user.email?.split("@")[0] ||
                "Unknown User",
            })
          );

          setAllUsers(transformedUsers);
        } catch (error) {
          console.error("Failed to load initial users:", error);
          setAllUsers([]);
        } finally {
          setUserSearchLoading(false);
        }
      }
    };
    init();
  }, [getCurrentAdmin]);

  useEffect(() => {
    if (currentAdmin) {
      loadUsers();
      loadAssignments();
    }
  }, [currentAdmin, loadUsers, loadAssignments]);

  // Filter users based on search
  const filteredUsers = users.filter(
    (user) =>
      user.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hierarchy = getUserHierarchy();
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
      {/* Admin Role Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Crown className="w-5 h-5 mr-2" />
            Your Admin Level & Permissions
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
          </div>
          <div className="mt-4 text-sm text-gray-600">
            {currentAdmin.is_admin && !currentAdmin.is_superiormanager && (
              <p>
                You have full control over the entire admin panel and all users.
              </p>
            )}
            {currentAdmin.is_admin && currentAdmin.is_superiormanager && (
              <p>
                You can manage users with manager role that you assign, and
                users assigned to those managers.
              </p>
            )}
            {currentAdmin.is_manager && !currentAdmin.is_admin && (
              <p>You can only control users specifically assigned to you.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {message && (
        <Alert
          className={`${
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

      {/* Assignment Interface */}
      {(currentAdmin.is_admin || currentAdmin.is_manager) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <UserPlus className="w-5 h-5 mr-2" />
              User & Manager Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Assign Users to Managers */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3 flex items-center">
                <UserPlus className="w-4 h-4 mr-2" />
                Assign Users to Managers
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="manager-select">Select Manager</Label>
                  <Select
                    value={selectedManager}
                    onValueChange={setSelectedManager}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableManagers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.display_name} ({manager.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {availableManagers.length} managers available
                  </p>
                </div>
                <div>
                  <Label htmlFor="user-select">
                    Search & Select User to Assign
                  </Label>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={userSearchTerm}
                        onChange={(e) => handleUserSearchChange(e.target.value)}
                        className="pl-10"
                      />
                      {userSearchLoading && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin" />
                      )}
                    </div>
                    <Select
                      value={selectedUser}
                      onValueChange={setSelectedUser}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a user from results" />
                      </SelectTrigger>
                      <SelectContent>
                        {allUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{user.display_name}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                ({user.email})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      {userSearchTerm.trim()
                        ? `${allUsers.length} users found`
                        : `${allUsers.length} users available (search to find more)`}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                onClick={assignUserToManager}
                disabled={!selectedUser || !selectedManager || actionLoading}
                className="bg-[#F26623] hover:bg-[#E55A1F] mt-3"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {actionLoading ? "Assigning..." : "Assign User to Manager"}
              </Button>
            </div>

            {/* Assign Managers to Superior Managers - Only for Full Admin */}
            {hasFullAdminAccess() && (
              <div className="border rounded-lg p-4 bg-purple-50 border-purple-200">
                <h4 className="font-medium mb-3 flex items-center text-purple-800">
                  <Crown className="w-4 h-4 mr-2" />
                  Assign Managers to Superior Managers
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="superior-select">
                      Select Superior Manager
                    </Label>
                    <Select
                      value={selectedSuperiorManager}
                      onValueChange={setSelectedSuperiorManager}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a superior manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableSuperiorManagers().map((superior) => (
                          <SelectItem key={superior.id} value={superior.id}>
                            {superior.display_name} ({superior.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-purple-600 mt-1">
                      {getAvailableSuperiorManagers().length} superior managers
                      available
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="manager-for-superior-select">
                      Select Manager to Assign
                    </Label>
                    <Select
                      value={selectedManagerForSuperior}
                      onValueChange={setSelectedManagerForSuperior}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAssignableManagers().map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.display_name} ({manager.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-purple-600 mt-1">
                      {getAssignableManagers().length} unassigned managers
                      available
                    </p>
                  </div>
                </div>
                <Button
                  onClick={assignManagerToSuperior}
                  disabled={
                    !selectedManagerForSuperior ||
                    !selectedSuperiorManager ||
                    actionLoading
                  }
                  className="bg-purple-600 hover:bg-purple-700 mt-3"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  {actionLoading
                    ? "Assigning..."
                    : "Assign Manager to Superior"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Role Management */}
      {currentAdmin.is_admin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Role Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search users to modify roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div>
                        <p className="font-medium">{user.display_name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <div className="flex space-x-1">
                        {user.is_admin && (
                          <Badge className="bg-red-100 text-red-800">
                            Admin
                          </Badge>
                        )}
                        {user.is_superiormanager && (
                          <Badge className="bg-purple-100 text-purple-800">
                            Superior
                          </Badge>
                        )}
                        {user.is_manager && (
                          <Badge className="bg-blue-100 text-blue-800">
                            Manager
                          </Badge>
                        )}
                      </div>
                    </div>

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
                          >
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
                          >
                            Remove Manager
                          </Button>
                        )}
                        {currentAdmin.is_admin &&
                          !currentAdmin.is_superiormanager && (
                            <>
                              {!user.is_superiormanager && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateUserRole(
                                      user.id,
                                      "is_superiormanager",
                                      true
                                    )
                                  }
                                  disabled={actionLoading}
                                >
                                  Make Superior
                                </Button>
                              )}
                              {!user.is_admin && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateUserRole(user.id, "is_admin", true)
                                  }
                                  disabled={actionLoading}
                                >
                                  Make Admin
                                </Button>
                              )}
                            </>
                          )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hierarchy Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            User Hierarchy & Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto mb-4"></div>
              <p className="text-gray-600">Loading hierarchy...</p>
            </div>
          ) : Object.keys(hierarchy).length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No user assignments found</p>
              <p className="text-sm text-gray-500">
                Start by assigning users to managers above
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(hierarchy).map(
                ([managerId, data]: [string, any]) => (
                  <div key={managerId} className="border rounded-lg">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleManagerExpansion(managerId)}
                    >
                      <div className="flex items-center space-x-3">
                        {expandedManagers.has(managerId) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <UserCheck className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-medium">
                            {data.manager?.display_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {data.manager?.email}
                          </p>
                        </div>
                        <div className="flex space-x-1">
                          {data.manager?.is_admin && (
                            <Badge className="bg-red-100 text-red-800">
                              Admin
                            </Badge>
                          )}
                          {data.manager?.is_superiormanager && (
                            <Badge className="bg-purple-100 text-purple-800">
                              Superior
                            </Badge>
                          )}
                          <Badge className="bg-blue-100 text-blue-800">
                            Manager
                          </Badge>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {data.assignedUsers.length} assigned users
                      </Badge>
                    </div>

                    {expandedManagers.has(managerId) && (
                      <div className="border-t bg-gray-50 p-4">
                        <div className="space-y-2">
                          {data.assignedUsers.map(
                            ({ user, assignment }: any) => (
                              <div
                                key={user.id}
                                className="flex items-center justify-between p-2 bg-white rounded border"
                              >
                                <div className="flex items-center space-x-3">
                                  <Users className="w-4 h-4 text-gray-400" />
                                  <div>
                                    <p className="text-sm font-medium">
                                      {user.display_name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {user.email}
                                    </p>
                                  </div>
                                  <Badge
                                    className={`text-xs ${
                                      user.kyc_status === "approved"
                                        ? "bg-green-100 text-green-800"
                                        : user.kyc_status === "pending"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {user.kyc_status}
                                  </Badge>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-500">
                                    Assigned{" "}
                                    {new Date(
                                      assignment.created_at
                                    ).toLocaleDateString()}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      removeAssignment(assignment.id)
                                    }
                                    disabled={actionLoading}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <UserMinus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
