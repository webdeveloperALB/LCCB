"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Send,
  Trash2,
  Users,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Search,
  Loader2,
  X,
  CheckCircle2,
  Shield,
  Crown,
  UserCheck,
} from "lucide-react";

interface Message {
  id: string;
  user_id: string;
  title: string;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
}

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
}

interface CurrentAdmin {
  id: string;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
}

export default function MessageManager() {
  // Core state
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [accessibleUserIds, setAccessibleUserIds] = useState<string[]>([]);
  const [accessibleUserIdsLoaded, setAccessibleUserIdsLoaded] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [alert, setAlert] = useState("");
  const [newMessage, setNewMessage] = useState({
    title: "",
    content: "",
    message_type: "info",
    target_type: "all" as "all" | "selected",
  });
  const [userSearch, setUserSearch] = useState("");
  const [totalUserCount, setTotalUserCount] = useState(0);

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
      return "Full Administrator - Can send messages to all users";
    }
    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      return "Superior Manager - Can send messages to assigned managers and their users";
    }
    if (currentAdmin.is_manager) {
      return "Manager - Can send messages to assigned users only";
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
            "id, email, full_name, first_name, last_name, created_at, kyc_status, is_admin, is_manager, is_superiormanager"
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
          .limit(10)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const transformedUsers = data.map((user: any) => ({
            id: user.id,
            email: user.email,
            full_name:
              user.full_name ||
              `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
              user.email?.split("@")[0] ||
              "Unknown",
            first_name: user.first_name,
            last_name: user.last_name,
            created_at: user.created_at,
            kyc_status: user.kyc_status,
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

  // Fetch total user count based on hierarchy
  const fetchTotalUserCount = useCallback(async () => {
    if (!currentAdmin || !accessibleUserIdsLoaded) {
      console.log(
        "Cannot fetch user count - admin or accessible IDs not ready"
      );
      return;
    }

    try {
      console.log("Fetching total user count for admin:", currentAdmin);

      if (accessibleUserIds.length > 0) {
        // Count only accessible users
        console.log("Counting accessible users:", accessibleUserIds);
        const { data, error } = await supabase
          .from("users")
          .select("id")
          .in("id", accessibleUserIds);

        if (error) throw error;
        setTotalUserCount(data?.length || 0);
        console.log(`Total accessible users: ${data?.length || 0}`);
      } else if (
        currentAdmin.is_admin &&
        !currentAdmin.is_superiormanager &&
        !currentAdmin.is_manager
      ) {
        // Full admin - count all users (using count instead of selecting all data)
        console.log("Full admin - counting all users");
        const { count, error } = await supabase
          .from("users")
          .select("*", { count: "exact", head: true });

        if (error) throw error;
        setTotalUserCount(count || 0);
        console.log(`Total users (full admin): ${count || 0}`);
      } else {
        // No accessible users
        console.log("No accessible users for count");
        setTotalUserCount(0);
      }
    } catch (error) {
      console.error("Error fetching user count:", error);
      setTotalUserCount(0);
    }
  }, [currentAdmin, accessibleUserIds, accessibleUserIdsLoaded]);

  // Fetch messages based on hierarchy
  const fetchMessages = useCallback(async () => {
    if (!currentAdmin || !accessibleUserIdsLoaded) {
      console.log("Cannot fetch messages - admin or accessible IDs not ready");
      return;
    }

    try {
      console.log("Fetching messages for admin:", currentAdmin);

      let query = supabase.from("user_messages").select("*");

      // Use cached accessible user IDs
      console.log(
        "Using cached accessible user IDs for messages:",
        accessibleUserIds
      );

      if (accessibleUserIds.length > 0) {
        console.log(
          "Filtering messages to accessible user IDs:",
          accessibleUserIds
        );
        query = query.in("user_id", accessibleUserIds);
      } else if (
        currentAdmin.is_admin &&
        !currentAdmin.is_superiormanager &&
        !currentAdmin.is_manager
      ) {
        // Full admin sees all messages - no filter needed
        console.log("Full admin - loading all messages");
      } else {
        // No accessible users
        console.log("No accessible users for messages");
        query = query.eq("user_id", "00000000-0000-0000-0000-000000000000"); // No results
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching messages:", error.message || error);
        setAlert(
          `Error fetching messages: ${error.message || "Unknown error"}`
        );
        return;
      }

      setMessages(data || []);
      console.log(`Loaded ${data?.length || 0} messages`);
    } catch (error: any) {
      console.error("Error fetching messages:", error.message || error);
      setAlert(`Error fetching messages: ${error.message || "Unknown error"}`);
    }
  }, [currentAdmin, accessibleUserIds, accessibleUserIdsLoaded]);

  // Fetch all users - IMPROVED FUNCTION to handle large datasets
  const fetchAllUsers = useCallback(async (): Promise<User[]> => {
    try {
      console.log("Fetching ALL users from database");

      // Use count first to see how many users we're dealing with
      const { count, error: countError } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true });

      if (countError) throw countError;
      console.log(`Database contains ${count || 0} total users`);

      // For very large datasets (>10k users), we might want to use a different approach
      // But for now, let's fetch all users without using range()
      const { data, error } = await supabase
        .from("users")
        .select(
          "id, email, full_name, first_name, last_name, created_at, kyc_status, is_admin, is_manager, is_superiormanager"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const transformedUsers = (data || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name:
          user.full_name ||
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.email?.split("@")[0] ||
          "Unknown",
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at,
        kyc_status: user.kyc_status,
        is_admin: user.is_admin || false,
        is_manager: user.is_manager || false,
        is_superiormanager: user.is_superiormanager || false,
      }));

      console.log(
        `Successfully fetched ${transformedUsers.length} users from database`
      );
      return transformedUsers;
    } catch (error) {
      console.error("Error fetching all users:", error);
      throw error;
    }
  }, []);

  // Send message with hierarchy validation
  const sendMessage = useCallback(async () => {
    if (!newMessage.title.trim() || !newMessage.content.trim()) {
      setAlert("Please fill in both title and content");
      return;
    }

    if (newMessage.target_type === "selected" && selectedUsers.length === 0) {
      setAlert("Please select at least one user or choose 'All Users'");
      return;
    }

    if (!currentAdmin) {
      setAlert("Admin session not found");
      return;
    }

    setLoading(true);
    try {
      if (newMessage.target_type === "all") {
        // Send to all accessible users
        let targetUsers: User[] = [];

        if (accessibleUserIds.length > 0) {
          // Get accessible users only
          console.log("Sending to accessible users:", accessibleUserIds);
          const { data, error } = await supabase
            .from("users")
            .select(
              "id, email, full_name, first_name, last_name, created_at, kyc_status, is_admin, is_manager, is_superiormanager"
            )
            .in("id", accessibleUserIds);

          if (error) throw error;
          targetUsers = data || [];
        } else if (
          currentAdmin.is_admin &&
          !currentAdmin.is_superiormanager &&
          !currentAdmin.is_manager
        ) {
          // Full admin - get ALL users using the improved function
          console.log("Full admin - fetching ALL users from database");
          targetUsers = await fetchAllUsers();
        } else {
          // No accessible users
          console.log("No accessible users for message sending");
          setAlert("You don't have permission to send messages to any users");
          return;
        }

        console.log(
          `Preparing to send messages to ${targetUsers.length} users`
        );

        // Send messages in batches of 100 for better performance
        const messageData = targetUsers.map((user) => ({
          user_id: user.id,
          title: newMessage.title,
          content: newMessage.content,
          message_type: newMessage.message_type,
          is_read: false,
        }));

        console.log(`Created ${messageData.length} message records to insert`);

        // Insert in batches of 100
        let successCount = 0;
        let errorCount = 0;
        const batchSize = 100;

        for (let i = 0; i < messageData.length; i += batchSize) {
          const batch = messageData.slice(i, i + batchSize);
          console.log(
            `Inserting batch ${Math.floor(i / batchSize) + 1} with ${
              batch.length
            } messages`
          );

          const { error } = await supabase.from("user_messages").insert(batch);

          if (error) {
            console.error(
              `Batch ${Math.floor(i / batchSize) + 1} error:`,
              error
            );
            errorCount += batch.length;
          } else {
            successCount += batch.length;
            console.log(
              `Batch ${Math.floor(i / batchSize) + 1} successful: ${
                batch.length
              } messages`
            );
          }
        }

        if (errorCount > 0) {
          setAlert(
            `Message sent to ${successCount} users, ${errorCount} failed`
          );
        } else {
          setAlert(`Message sent successfully to all ${successCount} users!`);
        }
      } else {
        // Send to selected users - validate permissions
        const unauthorizedUsers = selectedUsers.filter(
          (user) =>
            accessibleUserIds.length > 0 && !accessibleUserIds.includes(user.id)
        );

        if (unauthorizedUsers.length > 0 && !hasFullAdminAccess) {
          setAlert(
            `You don't have permission to send messages to ${unauthorizedUsers.length} of the selected users`
          );
          return;
        }

        // Send to selected users
        const messageData = selectedUsers.map((user) => ({
          user_id: user.id,
          title: newMessage.title,
          content: newMessage.content,
          message_type: newMessage.message_type,
          is_read: false,
        }));

        const { error } = await supabase
          .from("user_messages")
          .insert(messageData);

        if (error) {
          console.error("Error sending message:", error);
          setAlert(`Error sending message: ${error.message}`);
        } else {
          setAlert(
            `Message sent to ${selectedUsers.length} users successfully!`
          );
        }
      }

      // Reset form
      setNewMessage({
        title: "",
        content: "",
        message_type: "info",
        target_type: "all",
      });
      setSelectedUsers([]);
      setUserSearch("");

      // Refresh messages
      await fetchMessages();
    } catch (error: any) {
      console.error("Error sending message:", error);
      setAlert(`Error sending message: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [
    newMessage,
    selectedUsers,
    currentAdmin,
    accessibleUserIds,
    hasFullAdminAccess,
    fetchMessages,
    fetchAllUsers,
  ]);

  // Delete message with permission check
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!currentAdmin) {
        setAlert("Admin session not found");
        return;
      }

      try {
        // Get the message to check if admin can delete it
        const { data: messageData, error: fetchError } = await supabase
          .from("user_messages")
          .select("user_id")
          .eq("id", messageId)
          .single();

        if (fetchError) throw fetchError;

        // Check if admin can manage this user's messages
        const canDeleteMessage =
          accessibleUserIds.length === 0 || // Full admin
          accessibleUserIds.includes(messageData.user_id); // User is accessible

        if (!canDeleteMessage) {
          setAlert("You don't have permission to delete this message");
          return;
        }

        const { error } = await supabase
          .from("user_messages")
          .delete()
          .eq("id", messageId);

        if (error) {
          console.error("Error deleting message:", error);
          setAlert(`Error deleting message: ${error.message}`);
          return;
        }

        setAlert("Message deleted successfully!");
        await fetchMessages();
      } catch (error: any) {
        console.error("Error deleting message:", error);
        setAlert(`Error deleting message: ${error.message || "Unknown error"}`);
      }
    },
    [currentAdmin, accessibleUserIds, fetchMessages]
  );

  // Helper functions
  const addSelectedUser = useCallback(
    (user: User) => {
      if (!selectedUsers.find((u) => u.id === user.id)) {
        setSelectedUsers([...selectedUsers, user]);
      }
      setUserSearch("");
      setSearchResults([]);
    },
    [selectedUsers]
  );

  const removeSelectedUser = useCallback(
    (userId: string) => {
      setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
    },
    [selectedUsers]
  );

  const getUserDisplayName = useCallback((user: User) => {
    return user.full_name || user.email || `User ${user.id.slice(0, 8)}`;
  }, []);

  const getMessageIcon = useCallback((type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "alert":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  }, []);

  const getMessageTypeColor = useCallback((type: string) => {
    switch (type) {
      case "success":
        return "bg-green-100 text-green-800";
      case "alert":
        return "bg-red-100 text-red-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
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
          setAlert("Failed to load admin permissions");
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

  // EFFECT 3: Load data when accessible user IDs are ready - STABLE
  useEffect(() => {
    if (currentAdmin && accessibleUserIdsLoaded) {
      console.log(
        "Loading messages and user count - admin ready and accessible IDs loaded"
      );
      fetchMessages();
      fetchTotalUserCount();
    }
  }, [
    currentAdmin,
    accessibleUserIdsLoaded,
    fetchMessages,
    fetchTotalUserCount,
  ]); // Stable dependencies

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
            You need admin or manager permissions to send messages.
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
      {alert && (
        <Alert className="border-blue-500 bg-blue-50">
          <Info className="h-4 w-4" />
          <AlertDescription>{alert}</AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAlert("")}
            className="ml-auto"
            aria-label="Close alert"
          >
            ×
          </Button>
        </Alert>
      )}

      {/* Send New Message */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Send className="h-5 w-5 mr-2" />
            Send New Message
          </CardTitle>
          <CardDescription>
            Broadcast messages to users or send to specific individuals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Target Selection */}
          <div className="space-y-4">
            <label className="text-sm font-medium">Target Audience</label>

            {/* Target Type Selection */}
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="target_type"
                  value="all"
                  checked={newMessage.target_type === "all"}
                  onChange={(e) =>
                    setNewMessage({
                      ...newMessage,
                      target_type: e.target.value as "all" | "selected",
                    })
                  }
                />
                <span>
                  {hasFullAdminAccess
                    ? `All Users (${totalUserCount})`
                    : `All Accessible Users (${totalUserCount})`}
                </span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="target_type"
                  value="selected"
                  checked={newMessage.target_type === "selected"}
                  onChange={(e) =>
                    setNewMessage({
                      ...newMessage,
                      target_type: e.target.value as "all" | "selected",
                    })
                  }
                />
                <span>Selected Users ({selectedUsers.length})</span>
              </label>
            </div>

            {/* User Search and Selection */}
            {newMessage.target_type === "selected" && (
              <div className="space-y-3">
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

                {/* Search Results */}
                {userSearch.length >= 2 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.length > 0 ? (
                      searchResults.map((user) => {
                        const roles = getRoleBadges(user);
                        return (
                          <div
                            key={user.id}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                            onClick={() => addSelectedUser(user)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Users className="h-4 w-4 text-gray-400" />
                                <div>
                                  <p className="font-medium text-sm">
                                    {getUserDisplayName(user)}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    DCB{user.id.slice(0, 6)} • {user.email}
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
                        You can only send messages to users specifically
                        assigned to you
                      </p>
                    )}
                    {currentAdmin.is_admin &&
                      currentAdmin.is_superiormanager && (
                        <p className="text-xs text-blue-600 mt-1">
                          You can send messages to managers you assigned and
                          their users
                        </p>
                      )}
                  </div>
                )}

                {/* Selected Users */}
                {selectedUsers.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Selected Users:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedUsers.map((user) => {
                        const roles = getRoleBadges(user);
                        return (
                          <div
                            key={user.id}
                            className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                          >
                            <span>{getUserDisplayName(user)}</span>
                            {roles.length > 0 && (
                              <Badge className={`text-xs ${roles[0].color}`}>
                                {roles[0].label}
                              </Badge>
                            )}
                            <button
                              onClick={() => removeSelectedUser(user.id)}
                              className="hover:bg-blue-200 rounded-full p-0.5"
                              aria-label="Remove user"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Message Type */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Message Type
            </label>
            <Select
              value={newMessage.message_type}
              onValueChange={(value) =>
                setNewMessage({ ...newMessage, message_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Information</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="alert">Alert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Title</label>
            <Input
              placeholder="Message title..."
              value={newMessage.title}
              onChange={(e) =>
                setNewMessage({ ...newMessage, title: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Content</label>
            <Textarea
              placeholder="Message content..."
              value={newMessage.content}
              onChange={(e) =>
                setNewMessage({ ...newMessage, content: e.target.value })
              }
              rows={4}
            />
          </div>
          <Button onClick={sendMessage} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Message"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Message History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            Message History
          </CardTitle>
          <CardDescription>
            Recent messages sent to accessible users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No messages sent yet</p>
              <p className="text-sm">Messages you send will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getMessageIcon(message.message_type)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium">{message.title}</h4>
                          <Badge
                            className={getMessageTypeColor(
                              message.message_type
                            )}
                          >
                            {message.message_type}
                          </Badge>
                          {!message.is_read && (
                            <Badge variant="secondary">Unread</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {message.content}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>To: User {message.user_id.slice(0, 8)}...</span>
                          <span>
                            {new Date(message.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMessage(message.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
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
