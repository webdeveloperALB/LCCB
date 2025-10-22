"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MessageCircle,
  Send,
  User,
  X,
  Minimize2,
  Maximize2,
  Wifi,
  WifiOff,
  Shield,
  Crown,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface ChatSession {
  id: string;
  client_name: string | null;
  client_email: string | null;
  client_user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  unread_count?: number;
}

interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: "client" | "admin";
  sender_name: string | null;
  message: string;
  created_at: string;
  read_by_admin: boolean;
  read_by_client: boolean;
}

interface CurrentAdmin {
  id: string;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
}

export default function LiveChatAdmin() {
  const { toast } = useToast();

  // Core state
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [accessibleUserIds, setAccessibleUserIds] = useState<string[]>([]);
  const [accessibleUserIdsLoaded, setAccessibleUserIdsLoaded] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isMinimized, setIsMinimized] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionsPollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageCountRef = useRef(0);
  const lastSessionCountRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      return "Full Administrator - Can view all chat sessions";
    }
    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      return "Superior Manager - Can view chat sessions for assigned managers and their users";
    }
    if (currentAdmin.is_manager) {
      return "Manager - Can view chat sessions for assigned users only";
    }
    return "No admin permissions";
  }, [currentAdmin]);

  // Force scroll to bottom function
  const forceScrollToBottom = useCallback(() => {
    // Clear any existing scroll timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Multiple attempts to ensure scrolling works
    const scrollAttempts = [0, 50, 100, 200, 300, 500];

    scrollAttempts.forEach((delay) => {
      scrollTimeoutRef.current = setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({
            behavior: delay === 0 ? "auto" : "smooth",
            block: "end",
          });
        }
      }, delay);
    });
  }, []);

  // Fetch chat sessions with hierarchy filtering - STABLE FUNCTION
  const fetchSessions = useCallback(
    async (silent = false) => {
      if (!currentAdmin || !accessibleUserIdsLoaded) {
        console.log(
          "Cannot fetch sessions - admin or accessible IDs not ready"
        );
        return;
      }

      try {
        console.log("Fetching chat sessions for admin:", currentAdmin);

        let query = supabase.from("chat_sessions").select("*");

        // Use cached accessible user IDs
        console.log(
          "Using cached accessible user IDs for chat sessions:",
          accessibleUserIds
        );

        if (accessibleUserIds.length > 0) {
          console.log(
            "Filtering chat sessions to accessible user IDs:",
            accessibleUserIds
          );
          query = query.in("client_user_id", accessibleUserIds);
        } else if (
          currentAdmin.is_admin &&
          !currentAdmin.is_superiormanager &&
          !currentAdmin.is_manager
        ) {
          // Full admin sees all sessions - no filter needed
          console.log("Full admin - loading all chat sessions");
        } else {
          // No accessible users
          console.log("No accessible users for chat sessions");
          query = query.eq(
            "client_user_id",
            "00000000-0000-0000-0000-000000000000"
          ); // No results
        }

        const { data, error } = await query.order("last_message_at", {
          ascending: false,
        });

        if (error) throw error;

        // Get unread counts for each accessible session
        const sessionsWithUnread = await Promise.all(
          (data || []).map(async (session) => {
            const { count } = await supabase
              .from("chat_messages")
              .select("*", { count: "exact", head: true })
              .eq("session_id", session.id)
              .eq("sender_type", "client")
              .eq("read_by_admin", false);

            return {
              ...session,
              unread_count: count || 0,
            };
          })
        );

        // Only update if session count changed (silent updates)
        if (sessionsWithUnread.length !== lastSessionCountRef.current) {
          console.log(
            `ADMIN: Found ${sessionsWithUnread.length} accessible sessions (was ${lastSessionCountRef.current})`
          );
          setSessions(sessionsWithUnread);
          lastSessionCountRef.current = sessionsWithUnread.length;
        } else {
          // Update silently for unread counts
          setSessions(sessionsWithUnread);
        }

        setIsConnected(true);
      } catch (error) {
        console.error("Error fetching sessions:", error);
        setIsConnected(false);
        if (!silent) {
          setMessage({ type: "error", text: "Failed to load chat sessions" });
        }
      }
    },
    [currentAdmin, accessibleUserIds, accessibleUserIdsLoaded]
  );

  // Fetch messages for active session with permission check - STABLE FUNCTION
  const fetchMessages = useCallback(
    async (sessionId: string, silent = false) => {
      if (!currentAdmin || !accessibleUserIdsLoaded) {
        console.log(
          "Cannot fetch messages - admin or accessible IDs not ready"
        );
        return;
      }

      try {
        // First check if admin can access this session
        const session = sessions.find((s) => s.id === sessionId);
        if (!session) {
          console.log("Session not found in accessible sessions");
          return;
        }

        // Check if admin can access this user's chat
        const canAccessChat =
          accessibleUserIds.length === 0 || // Full admin
          (session.client_user_id &&
            accessibleUserIds.includes(session.client_user_id)); // User is accessible

        if (!canAccessChat) {
          setMessage({
            type: "error",
            text: "You don't have permission to view this chat session",
          });
          return;
        }

        const { data, error } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        const newMessages = data || [];

        // Always update messages and scroll if count changed or if it's the first load
        if (
          newMessages.length !== lastMessageCountRef.current ||
          messages.length === 0
        ) {
          console.log(
            `ADMIN: Found ${newMessages.length} messages (was ${lastMessageCountRef.current})`
          );

          // Check for new client messages for notifications
          const currentMessageIds = messages.map((m) => m.id);
          const newClientMessages = newMessages.filter(
            (msg) =>
              msg.sender_type === "client" &&
              !currentMessageIds.includes(msg.id)
          );

          setMessages(newMessages);
          lastMessageCountRef.current = newMessages.length;

          // Always scroll to bottom when messages are loaded/updated
          if (newMessages.length > 0 && !isMinimized) {
            console.log("ADMIN: Messages updated, scrolling to bottom");
            forceScrollToBottom();
          }

          // Show notification for new client messages (only if not silent)
          if (!silent && newClientMessages.length > 0) {
            toast({
              title: "New Message",
              description: `New message from ${
                newClientMessages[0].sender_name || "Client"
              }`,
            });
          }

          // Mark client messages as read by admin
          const unreadClientMessages = newMessages.filter(
            (msg) => msg.sender_type === "client" && !msg.read_by_admin
          );

          if (unreadClientMessages.length > 0) {
            await supabase
              .from("chat_messages")
              .update({ read_by_admin: true })
              .in(
                "id",
                unreadClientMessages.map((msg) => msg.id)
              );
          }
        }

        setIsConnected(true);
      } catch (error) {
        console.error("Error fetching messages:", error);
        setIsConnected(false);
        if (!silent) {
          setMessage({ type: "error", text: "Failed to load chat messages" });
        }
      }
    },
    [
      currentAdmin,
      accessibleUserIds,
      accessibleUserIdsLoaded,
      isMinimized,
      forceScrollToBottom,
      toast,
    ]
  );

  // Send message with permission check - STABLE FUNCTION
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !activeSession || !currentAdmin) return;

    // Check if admin can send messages to this session
    // Permission check will be done by the session filtering
    // If we can see the session, we can send messages to it

    const messageText = newMessage.trim();
    setNewMessage("");

    try {
      const messageData = {
        session_id: activeSession,
        sender_type: "admin" as const,
        sender_name: "Support Agent",
        message: messageText,
        read_by_admin: true,
        read_by_client: false,
      };

      const { data, error } = await supabase
        .from("chat_messages")
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      // Add message to local state immediately
      setMessages((prev) => {
        const updated = [...prev, data];
        lastMessageCountRef.current = updated.length;
        return updated;
      });

      // Update session timestamp
      await supabase
        .from("chat_sessions")
        .update({
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        })
        .eq("id", activeSession);
    } catch (error) {
      console.error("Error sending message:", error);
      // Restore message text on error
      setNewMessage(messageText);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  }, [newMessage, activeSession, currentAdmin, toast]);

  // Close session with permission check - STABLE FUNCTION
  const closeSession = useCallback(
    async (sessionId: string) => {
      if (!currentAdmin) {
        setMessage({ type: "error", text: "Admin session not found" });
        return;
      }

      try {
        // Permission check: if we can see the session, we can close it
        // Session filtering already handles hierarchy permissions

        const { error } = await supabase
          .from("chat_sessions")
          .update({ status: "closed" })
          .eq("id", sessionId);

        if (error) throw error;

        if (activeSession === sessionId) {
          setActiveSession(null);
          setMessages([]);
          lastMessageCountRef.current = 0;
        }

        toast({
          title: "Session Closed",
          description: "Chat session has been closed",
        });
      } catch (error) {
        console.error("Error closing session:", error);
        setMessage({ type: "error", text: "Failed to close session" });
      }
    },
    [currentAdmin, activeSession, toast]
  );

  // Handle minimize/maximize
  const handleMinimize = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const handleMaximize = useCallback(() => {
    setIsMinimized(false);
    // Force scroll when maximizing
    if (messages.length > 0 && activeSession) {
      console.log("ADMIN: Maximizing chat, scrolling to bottom");
      setTimeout(() => forceScrollToBottom(), 100);
    }
  }, [messages.length, activeSession, forceScrollToBottom]);

  // Format time functions - STABLE
  const formatTime = useCallback((timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const formatDate = useCallback((timestamp: string) => {
    return new Date(timestamp).toLocaleDateString();
  }, []);

  // Get role badges for user
  const getRoleBadges = useCallback((session: ChatSession) => {
    // This would need to be enhanced if we store user role info in chat sessions
    // For now, we can't determine roles from chat sessions alone
    return [];
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

  // EFFECT 3: Setup polling for sessions when accessible user IDs are ready - STABLE
  useEffect(() => {
    if (!currentAdmin || !accessibleUserIdsLoaded) {
      return;
    }

    console.log("ADMIN: Starting sessions polling");

    // Initial fetch
    fetchSessions(true);

    // Setup polling interval for sessions
    sessionsPollingRef.current = setInterval(() => {
      fetchSessions(true); // Silent updates
    }, 2000);

    return () => {
      if (sessionsPollingRef.current) {
        clearInterval(sessionsPollingRef.current);
        sessionsPollingRef.current = null;
      }
    };
  }, [currentAdmin, accessibleUserIdsLoaded, fetchSessions]);

  // EFFECT 4: Setup polling for messages when active session changes - STABLE
  useEffect(() => {
    if (!activeSession) {
      // Clean up message polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setMessages([]);
      lastMessageCountRef.current = 0;
      return;
    }

    console.log("ADMIN: Starting message polling for session:", activeSession);

    // Initial fetch
    fetchMessages(activeSession, true);

    // Setup polling interval for messages
    pollingIntervalRef.current = setInterval(() => {
      fetchMessages(activeSession, true); // Silent updates
    }, 2000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [activeSession, fetchMessages]);

  // EFFECT 5: Real-time subscriptions (as backup to polling) - STABLE
  useEffect(() => {
    console.log("ADMIN: Setting up real-time subscriptions");

    // Set up real-time subscription for sessions
    const sessionsChannel = supabase
      .channel("admin-sessions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_sessions",
        },
        () => {
          console.log("ADMIN: Real-time session change detected");
          fetchSessions(true);
        }
      )
      .subscribe((status) => {
        console.log("ADMIN: Sessions subscription status:", status);
        setIsConnected(status === "SUBSCRIBED");
      });

    // Set up real-time subscription for messages
    const messagesChannel = supabase
      .channel("admin-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          console.log("ADMIN: Real-time message received:", payload);
          const newMessage = payload.new as ChatMessage;

          // Just refresh sessions and messages via polling
          // This prevents complex state updates in real-time handlers
          console.log(
            "ADMIN: Real-time message detected, refreshing via polling"
          );
        }
      )
      .subscribe((status) => {
        console.log("ADMIN: Messages subscription status:", status);
      });

    return () => {
      console.log("ADMIN: Cleaning up real-time subscriptions");
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, []);

  // EFFECT 6: Scroll to bottom whenever messages change and not minimized - STABLE
  useEffect(() => {
    if (messages.length > 0 && !isMinimized && activeSession) {
      forceScrollToBottom();
    }
  }, [messages, isMinimized, activeSession, forceScrollToBottom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (sessionsPollingRef.current) {
        clearInterval(sessionsPollingRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Filter sessions based on hierarchy
  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === "active"),
    [sessions]
  );
  const closedSessions = useMemo(
    () => sessions.filter((s) => s.status === "closed"),
    [sessions]
  );

  // Loading state
  if (loadingPermissions) {
    return (
      <Card className="fixed bottom-4 right-4 w-[500px] h-[200px] z-50 flex flex-col shadow-2xl">
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm">Loading chat permissions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No admin session
  if (!currentAdmin) {
    return (
      <Card className="fixed bottom-4 right-4 w-[500px] h-[300px] z-50 flex flex-col shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Chat Access Error
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Admin Session Not Found
            </h3>
            <p className="text-gray-600 text-sm">
              Unable to verify your admin permissions for chat access.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if user has any admin access
  if (!currentAdmin.is_admin && !currentAdmin.is_manager) {
    return (
      <Card className="fixed bottom-4 right-4 w-[500px] h-[400px] z-50 flex flex-col shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <Shield className="w-5 h-5 mr-2" />
            Chat Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Admin Access Required
            </h3>
            <p className="text-gray-600 mb-4 text-sm">
              You need admin or manager permissions to access live chat.
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
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isMinimized) {
    return (
      <Card className="fixed bottom-4 right-4 w-60 z-50">
        <CardHeader className="pb-2 pt-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center">
              <MessageCircle className="w-4 h-4 mr-2" />
              Live Chat ({activeSessions.length})
              {isConnected ? (
                <Wifi className="w-3 h-3 ml-2 text-green-500" />
              ) : (
                <WifiOff className="w-3 h-3 ml-2 text-gray-400" />
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleMaximize}>
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            {currentAdmin.is_admin &&
              !currentAdmin.is_superiormanager &&
              !currentAdmin.is_manager && (
                <Badge className="bg-red-100 text-red-800 text-xs">
                  <Shield className="w-2 h-2 mr-1" />
                  Full Admin
                </Badge>
              )}
            {currentAdmin.is_admin && currentAdmin.is_superiormanager && (
              <Badge className="bg-purple-100 text-purple-800 text-xs">
                <Crown className="w-2 h-2 mr-1" />
                Superior
              </Badge>
            )}
            {currentAdmin.is_manager && (
              <Badge className="bg-blue-100 text-blue-800 text-xs">
                <UserCheck className="w-2 h-2 mr-1" />
                Manager
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-[500px] h-[650px] z-50 flex flex-col shadow-2xl">
      <CardHeader className="pb-2 flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center">
            <MessageCircle className="w-4 h-4 mr-2" />
            Live Chat Support
            {isConnected ? (
              <Wifi className="w-3 h-3 ml-2 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 ml-2 text-gray-400" />
            )}
          </CardTitle>
          <div className="flex items-center space-x-1">
            <Badge variant="secondary" className="text-xs">
              {activeSessions.length} Active
            </Badge>
            <span className="text-xs text-gray-500">
              {isConnected ? "• Real-time" : "• Polling"}
            </span>
            <Button variant="ghost" size="sm" onClick={handleMinimize}>
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Admin Level Display */}
        <div className="flex items-center space-x-2 mt-2">
          {currentAdmin.is_admin &&
            !currentAdmin.is_superiormanager &&
            !currentAdmin.is_manager && (
              <Badge className="bg-red-100 text-red-800 text-xs">
                <Shield className="w-2 h-2 mr-1" />
                Full Administrator
              </Badge>
            )}
          {currentAdmin.is_admin && currentAdmin.is_superiormanager && (
            <Badge className="bg-purple-100 text-purple-800 text-xs">
              <Crown className="w-2 h-2 mr-1" />
              Superior Manager
            </Badge>
          )}
          {currentAdmin.is_manager && (
            <Badge className="bg-blue-100 text-blue-800 text-xs">
              <UserCheck className="w-2 h-2 mr-1" />
              Manager
            </Badge>
          )}
          <span className="text-xs text-gray-600">
            {getAdminLevelDescription}
          </span>
        </div>
      </CardHeader>

      {message && (
        <div className="mx-4 mt-2">
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
        </div>
      )}

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <Tabs defaultValue="active" className="flex-1 flex flex-col h-full">
          <TabsList className="mx-4 mb-2 mt-2">
            <TabsTrigger value="active" className="text-xs">
              Active ({activeSessions.length})
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-xs">
              Closed ({closedSessions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="active"
            className="flex-1 flex h-full overflow-hidden"
          >
            <div className="flex w-full h-full">
              {/* Sessions List - Fixed width */}
              <div className="w-[200px] border-r bg-gray-50 flex-shrink-0">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-2">
                    {activeSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`p-3 rounded-lg cursor-pointer text-xs transition-colors ${
                          activeSession === session.id
                            ? "bg-blue-100 border-2 border-blue-300 shadow-sm"
                            : "bg-white hover:bg-gray-100 border border-gray-200"
                        }`}
                        onClick={() => setActiveSession(session.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center min-w-0">
                              <User className="w-3 h-3 mr-2 text-gray-600 flex-shrink-0" />
                              <span className="font-medium truncate text-gray-800">
                                {session.client_name || "Anonymous"}
                              </span>
                            </div>
                            {session.client_email && (
                              <div className="text-xs text-gray-500 truncate ml-5">
                                {session.client_email}
                              </div>
                            )}
                          </div>
                          {session.unread_count! > 0 && (
                            <Badge
                              variant="destructive"
                              className="text-xs px-2 py-1 ml-1 flex-shrink-0"
                            >
                              {session.unread_count}
                            </Badge>
                          )}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {formatTime(session.last_message_at)}
                        </div>
                      </div>
                    ))}
                    {activeSessions.length === 0 && (
                      <div className="text-center text-gray-500 text-xs py-8">
                        {currentAdmin.is_manager && (
                          <div className="space-y-2">
                            <p>No active chats from your assigned users</p>
                            <p className="text-xs">
                              You can only see chats from users assigned to you
                            </p>
                          </div>
                        )}
                        {currentAdmin.is_admin &&
                          currentAdmin.is_superiormanager && (
                            <div className="space-y-2">
                              <p>No active chats from your hierarchy</p>
                              <p className="text-xs">
                                You can see chats from managers you assigned and
                                their users
                              </p>
                            </div>
                          )}
                        {currentAdmin.is_admin &&
                          !currentAdmin.is_superiormanager &&
                          !currentAdmin.is_manager && <p>No active chats</p>}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Chat Area - Flexible width */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {activeSession ? (
                  <>
                    {/* Chat Header - Fixed height */}
                    <div className="p-3 border-b bg-gray-50 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium truncate">
                            {sessions.find((s) => s.id === activeSession)
                              ?.client_name || "Anonymous"}
                          </div>
                          {sessions.find((s) => s.id === activeSession)
                            ?.client_email && (
                            <div className="text-xs text-gray-500 truncate">
                              {
                                sessions.find((s) => s.id === activeSession)
                                  ?.client_email
                              }
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => closeSession(activeSession)}
                          className="text-xs h-6 px-2 flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Messages - Flexible height with proper scrolling */}
                    <div className="flex-1 overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="p-3 space-y-3">
                          {messages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${
                                message.sender_type === "admin"
                                  ? "justify-end"
                                  : "justify-start"
                              }`}
                            >
                              <div
                                className={`max-w-[80%] p-3 rounded-lg text-xs shadow-sm break-words ${
                                  message.sender_type === "admin"
                                    ? "bg-blue-500 text-white rounded-br-sm"
                                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                                }`}
                              >
                                <div className="leading-relaxed whitespace-pre-wrap">
                                  {message.message}
                                </div>
                                <div
                                  className={`text-xs mt-2 ${
                                    message.sender_type === "admin"
                                      ? "text-blue-100"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {formatTime(message.created_at)}
                                </div>
                              </div>
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Message Input - Fixed height */}
                    <div className="p-3 border-t bg-white flex-shrink-0">
                      <div className="flex space-x-2">
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type your message..."
                          className="text-sm flex-1"
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={sendMessage}
                          disabled={!newMessage.trim()}
                          className="px-3 bg-blue-500 hover:bg-blue-600 flex-shrink-0"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                    <div className="text-center">
                      <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Select a chat to start messaging</p>
                      <p className="text-xs mt-2">{getAdminLevelDescription}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="closed" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {closedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-2 rounded bg-gray-50 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          <span className="font-medium">
                            {session.client_name || "Anonymous"}
                          </span>
                        </div>
                        {session.client_email && (
                          <div className="text-xs text-gray-500 ml-4">
                            {session.client_email}
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Closed
                      </Badge>
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      {formatDate(session.updated_at)}
                    </div>
                  </div>
                ))}
                {closedSessions.length === 0 && (
                  <div className="text-center text-gray-500 text-xs py-4">
                    No closed chats
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
