"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Users,
  DollarSign,
  Mail,
  Database,
  Shield,
  Activity,
  Calculator,
  Wifi,
  Download,
  Clock,
  Lock,
  MapPin,
  Globe,
  Monitor,
  Crown,
  UserCheck,
  AlertTriangle,
  MessageCircle,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase";
import BalanceUpdater from "./balance-updater";
import MessageManager from "./message-manager";
import DatabaseTest from "./database-test";
import UserManagementTest from "./user-management-test";
import KYCAdminPanel from "./kyc-admin-panel";
import ActivityManager from "./activity-manager";
import TaxManager from "./tax-manager";
import UserPresenceTracker from "./user-presence-tracker";
import PresenceManager from "./presence-manager";
import LiveChatAdmin from "./live-chat-admin";
import UserHierarchyManager from "../../components/user-hierarchy-manager";
import UnifiedAdminPanel from "./UnifiedAdminPanel";

interface LocationInfo {
  ip: string;
  country: string;
  city: string;
  region: string;
  isp?: string;
  timezone?: string;
}

interface AdminSession {
  sessionId: string;
  ip: string;
  country: string;
  city: string;
  loginTime: number;
  lastActivity: number;
  isActive: boolean;
  userId: string;
}

interface LoginAttempt {
  timestamp: number;
  success: boolean;
  ip: string;
  country: string;
  sessionId?: string;
}

interface SecurityProps {
  sessionTimeLeft: number;
  sessionId: string;
  onLogout: () => void;
  loginAttempts: LoginAttempt[];
  activeSessions: AdminSession[];
  currentSessionId: string;
  onUpdateSession: (sessionId: string) => void;
}

interface CurrentAdmin {
  id: string;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
}

interface UserAssignment {
  id: string;
  manager_id: string;
  assigned_user_id: string;
  assigned_by: string;
  created_at: string;
}

export default function EnhancedAdminDashboard({
  sessionTimeLeft,
  sessionId,
  onLogout,
  loginAttempts,
  activeSessions,
  currentSessionId,
  onUpdateSession,
}: SecurityProps) {
  // Core state
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [accessibleUserIds, setAccessibleUserIds] = useState<string[]>([]);
  const [accessibleUserIdsLoaded, setAccessibleUserIdsLoaded] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [showLiveChat, setShowLiveChat] = useState(false);

  const [activeTab, setActiveTab] = useState("UnifiedAdminPanel");
  const [locationInfo, setLocationInfo] = useState<LocationInfo>({
    ip: "Detecting...",
    country: "Detecting...",
    city: "Detecting...",
    region: "Detecting...",
    isp: "Unknown",
    timezone: "Unknown",
  });
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    totalProfiles: 0,
    totalDeposits: 0,
    pendingDeposits: 0,
    totalVolume: 0,
    accessibleUsers: 0,
    accessibleDeposits: 0,
    accessibleVolume: 0,
  });
  const [securityStats, setSecurityStats] = useState({
    activeAdminSessions: activeSessions.length,
    lastLoginTime: new Date().toISOString(),
    totalLoginAttempts: loginAttempts.length,
    successfulLogins: loginAttempts.filter((a) => a.success).length,
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

  // Load assignments - STABLE FUNCTION
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
      return "Full Administrator - Complete system access";
    }
    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      return "Superior Manager - Manages assigned managers and their users";
    }
    if (currentAdmin.is_manager) {
      return "Manager - Manages assigned users only";
    }
    return "No admin permissions";
  }, [currentAdmin]);

  // Fetch location info and update session
  useEffect(() => {
    const fetchLocationAndUpdateSession = async () => {
      try {
        console.log("Dashboard: Fetching location info...");

        // Try multiple IP services in sequence
        let ipAddress: string | null = null;

        // Service 1: ipify
        try {
          const ipResponse = await fetch("https://api.ipify.org?format=json", {
            signal: AbortSignal.timeout(3000),
          });
          const ipData = await ipResponse.json();
          if (ipData.ip) {
            ipAddress = ipData.ip;
            setLocationInfo((prev) => ({ ...prev, ip: ipData.ip }));
            console.log("Got IP from ipify:", ipData.ip);
          }
        } catch (error) {
          console.log("ipify failed:", error);
        }

        // Service 2: ipapi.co if first failed
        if (!ipAddress) {
          try {
            const ipResponse = await fetch("https://ipapi.co/ip/", {
              signal: AbortSignal.timeout(3000),
            });
            const ip = await ipResponse.text();
            if (ip && ip.trim()) {
              ipAddress = ip.trim();
              setLocationInfo((prev) => ({ ...prev, ip: ipAddress! }));
              console.log("Got IP from ipapi.co:", ipAddress);
            }
          } catch (error) {
            console.log("ipapi.co IP failed:", error);
          }
        }

        // Service 3: httpbin if others failed
        if (!ipAddress) {
          try {
            const ipResponse = await fetch("https://httpbin.org/ip", {
              signal: AbortSignal.timeout(3000),
            });
            const ipData = await ipResponse.json();
            if (ipData.origin) {
              ipAddress = ipData.origin.split(",")[0].trim(); // Handle multiple IPs
              setLocationInfo((prev) => ({ ...prev, ip: ipAddress! }));
              console.log("Got IP from httpbin:", ipAddress);
            }
          } catch (error) {
            console.log("httpbin failed:", error);
          }
        }

        // Now try to get location data if we have an IP
        if (ipAddress) {
          // Try multiple location services
          let locationFound = false;

          // Location Service 1: ipapi.co
          if (!locationFound) {
            try {
              const locationResponse = await fetch(
                `https://ipapi.co/${ipAddress}/json/`,
                {
                  signal: AbortSignal.timeout(5000),
                }
              );
              const locationData = await locationResponse.json();

              if (
                locationData &&
                !locationData.error &&
                locationData.country_name
              ) {
                const fullLocationInfo = {
                  ip: ipAddress,
                  country: locationData.country_name || "Unknown",
                  city: locationData.city || "Unknown",
                  region: locationData.region || "Unknown",
                  isp: locationData.org || "Unknown",
                  timezone: locationData.timezone || "Unknown",
                };

                setLocationInfo(fullLocationInfo);
                locationFound = true;
                console.log("Got location from ipapi.co:", fullLocationInfo);
              }
            } catch (error) {
              console.log("ipapi.co location failed:", error);
            }
          }

          // Location Service 2: ip-api.com
          if (!locationFound) {
            try {
              const locationResponse = await fetch(
                `http://ip-api.com/json/${ipAddress}`,
                {
                  signal: AbortSignal.timeout(5000),
                }
              );
              const locationData = await locationResponse.json();

              if (locationData && locationData.status === "success") {
                const fullLocationInfo = {
                  ip: ipAddress,
                  country: locationData.country || "Unknown",
                  city: locationData.city || "Unknown",
                  region: locationData.regionName || "Unknown",
                  isp: locationData.isp || "Unknown",
                  timezone: locationData.timezone || "Unknown",
                };

                setLocationInfo(fullLocationInfo);
                locationFound = true;
                console.log("Got location from ip-api.com:", fullLocationInfo);
              }
            } catch (error) {
              console.log("ip-api.com failed:", error);
            }
          }

          // Location Service 3: ipgeolocation.io (free tier)
          if (!locationFound) {
            try {
              const locationResponse = await fetch(
                `https://api.ipgeolocation.io/ipgeo?apiKey=free&ip=${ipAddress}`,
                {
                  signal: AbortSignal.timeout(5000),
                }
              );
              const locationData = await locationResponse.json();

              if (locationData && locationData.country_name) {
                const fullLocationInfo = {
                  ip: ipAddress,
                  country: locationData.country_name || "Unknown",
                  city: locationData.city || "Unknown",
                  region: locationData.state_prov || "Unknown",
                  isp: locationData.isp || "Unknown",
                  timezone: locationData.time_zone?.name || "Unknown",
                };

                setLocationInfo(fullLocationInfo);
                locationFound = true;
                console.log(
                  "Got location from ipgeolocation.io:",
                  fullLocationInfo
                );
              }
            } catch (error) {
              console.log("ipgeolocation.io failed:", error);
            }
          }

          // Location Service 4: ipinfo.io
          if (!locationFound) {
            try {
              const locationResponse = await fetch(
                `https://ipinfo.io/${ipAddress}/json`,
                {
                  signal: AbortSignal.timeout(5000),
                }
              );
              const locationData = await locationResponse.json();

              if (locationData && locationData.country) {
                const fullLocationInfo = {
                  ip: ipAddress,
                  country: locationData.country || "Unknown",
                  city: locationData.city || "Unknown",
                  region: locationData.region || "Unknown",
                  isp: locationData.org || "Unknown",
                  timezone: locationData.timezone || "Unknown",
                };

                setLocationInfo(fullLocationInfo);
                locationFound = true;
                console.log("Got location from ipinfo.io:", fullLocationInfo);
              }
            } catch (error) {
              console.log("ipinfo.io failed:", error);
            }
          }

          // If no location service worked
          if (!locationFound) {
            setLocationInfo((prev) => ({
              ...prev,
              country: "Location services unavailable",
              city: "Unable to determine",
              region: "Unknown",
            }));
            console.log("All location services failed");
          }
        } else {
          // No IP address could be determined
          setLocationInfo({
            ip: "IP detection failed",
            country: "Unable to determine",
            city: "Unknown",
            region: "Unknown",
            isp: "Unknown",
            timezone: "Unknown",
          });
          console.log("Failed to get IP address from all services");
        }
      } catch (error) {
        console.error("Dashboard: Location fetch error:", error);
        setLocationInfo((prev) => ({
          ...prev,
          ip: "Detection failed",
          country: "Service error",
          city: "Unknown",
          region: "Unknown",
        }));
      }
    };

    fetchLocationAndUpdateSession();
  }, []); // Remove sessionId dependency to avoid loops

  // Fetch system stats with hierarchy awareness - STABLE FUNCTION - FIXED FOR LARGE DATASETS
  const fetchSystemStats = useCallback(async () => {
    if (!currentAdmin || !accessibleUserIdsLoaded) {
      console.log(
        "Cannot fetch system stats - admin or accessible IDs not ready"
      );
      return;
    }

    try {
      console.log(
        "Fetching hierarchy-aware system stats for admin:",
        currentAdmin
      );

      // Get total system stats using COUNT queries (more efficient for large datasets)
      let totalUsers = 0;
      let totalProfiles = 0;
      let totalDeposits = 0;
      let totalVolume = 0;

      // Use count queries instead of fetching all data
      try {
        console.log("Fetching total user count using count query...");
        const { count: userCount, error: userCountError } = await supabase
          .from("users")
          .select("*", { count: "exact", head: true });

        if (!userCountError) {
          totalUsers = userCount || 0;
          console.log("Total users count:", totalUsers);
        } else {
          console.error("Error getting user count:", userCountError);
        }

        console.log("Fetching total profile count...");
        const { count: profileCount, error: profileError } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });

        if (!profileError) {
          totalProfiles = profileCount || 0;
          console.log("Total profiles count:", totalProfiles);
        }

        console.log("Fetching total deposit count and volume...");
        const { count: depositCount, error: depositCountError } = await supabase
          .from("deposits")
          .select("*", { count: "exact", head: true });

        if (!depositCountError) {
          totalDeposits = depositCount || 0;
          console.log("Total deposits count:", totalDeposits);
        }

        // For volume calculation, we need to fetch amounts in batches to handle large datasets
        console.log("Calculating total deposit volume...");
        const { data: depositVolumes, error: volumeError } = await supabase
          .from("deposits")
          .select("amount")
          .limit(50000); // Increase limit for volume calculation

        if (!volumeError && depositVolumes) {
          totalVolume = depositVolumes.reduce(
            (sum, d) => sum + (d.amount || 0),
            0
          );
          console.log("Total volume calculated:", totalVolume);
        }
      } catch (error) {
        console.error("Error fetching total stats:", error);
      }

      // Get accessible stats based on hierarchy
      let accessibleUsers = 0;
      let accessibleDeposits = 0;
      let accessibleVolume = 0;
      let pendingDeposits = 0;

      if (accessibleUserIds.length > 0) {
        // Count accessible users using count query
        console.log("Counting accessible users:", accessibleUserIds);
        const { count: accessibleUserCount, error: accessibleUsersError } =
          await supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .in("id", accessibleUserIds);

        if (!accessibleUsersError) {
          accessibleUsers = accessibleUserCount || 0;
        }

        // Count accessible deposits using count query
        console.log(
          "Counting accessible deposits for users:",
          accessibleUserIds
        );
        const {
          count: accessibleDepositCount,
          error: accessibleDepositsCountError,
        } = await supabase
          .from("deposits")
          .select("*", { count: "exact", head: true })
          .in("uuid", accessibleUserIds);

        if (!accessibleDepositsCountError) {
          accessibleDeposits = accessibleDepositCount || 0;
        }

        // Calculate accessible volume and pending deposits
        const { data: accessibleDepositsData, error: accessibleDepositsError } =
          await supabase
            .from("deposits")
            .select("amount, status")
            .in("uuid", accessibleUserIds)
            .limit(50000); // Handle large datasets with higher limit

        if (!accessibleDepositsError && accessibleDepositsData) {
          accessibleVolume = accessibleDepositsData.reduce(
            (sum, d) => sum + (d.amount || 0),
            0
          );
          pendingDeposits = accessibleDepositsData.filter((d) =>
            d.status.includes("Pending")
          ).length;
        }
      } else if (
        currentAdmin.is_admin &&
        !currentAdmin.is_superiormanager &&
        !currentAdmin.is_manager
      ) {
        // Full admin - use total stats
        console.log("Full admin - using total stats");
        accessibleUsers = totalUsers;
        accessibleDeposits = totalDeposits;
        accessibleVolume = totalVolume;

        // Get pending deposits count for full admin
        const { count: pendingCount, error: pendingError } = await supabase
          .from("deposits")
          .select("*", { count: "exact", head: true })
          .like("status", "%Pending%");

        if (!pendingError) {
          pendingDeposits = pendingCount || 0;
        }
      } else {
        // No accessible users
        console.log("No accessible users for stats");
        accessibleUsers = 0;
        accessibleDeposits = 0;
        accessibleVolume = 0;
        pendingDeposits = 0;
      }

      const newStats = {
        totalUsers,
        totalProfiles,
        totalDeposits,
        pendingDeposits,
        totalVolume,
        accessibleUsers,
        accessibleDeposits,
        accessibleVolume,
      };

      console.log("Final hierarchy-aware system stats:", newStats);
      setSystemStats(newStats);
    } catch (error) {
      console.error("Error fetching system stats:", error);
      setSystemStats((prev) => ({
        ...prev,
        totalUsers: 0,
        totalProfiles: 0,
        accessibleUsers: 0,
        accessibleDeposits: 0,
        accessibleVolume: 0,
      }));
    }
  }, [currentAdmin, accessibleUserIds, accessibleUserIdsLoaded]);

  // Format time remaining
  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Get session status color
  const getSessionStatusColor = () => {
    if (sessionTimeLeft < 5 * 60 * 1000) return "text-red-600"; // Less than 5 minutes
    if (sessionTimeLeft < 10 * 60 * 1000) return "text-yellow-600"; // Less than 10 minutes
    return "text-green-600";
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
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

  // EFFECT 2: Load assignments and accessible user IDs when admin changes - STABLE
  useEffect(() => {
    let mounted = true;

    if (!currentAdmin) {
      setAccessibleUserIds([]);
      setAccessibleUserIdsLoaded(false);
      return;
    }

    const loadData = async () => {
      try {
        console.log(
          "Loading assignments and accessible user IDs for admin:",
          currentAdmin
        );

        // Load assignments
        await loadAssignments();

        // Load accessible user IDs
        const userIds = await loadAccessibleUserIds(currentAdmin);
        if (mounted) {
          setAccessibleUserIds(userIds);
          setAccessibleUserIdsLoaded(true);
          console.log("Cached accessible user IDs:", userIds);
        }
      } catch (error) {
        console.error("Failed to load admin data:", error);
        if (mounted) {
          setAccessibleUserIds([]);
          setAccessibleUserIdsLoaded(true);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [currentAdmin, loadAssignments, loadAccessibleUserIds]); // Only depends on currentAdmin and stable functions

  // EFFECT 3: Fetch system stats when accessible user IDs are ready - STABLE
  useEffect(() => {
    if (currentAdmin && accessibleUserIdsLoaded) {
      console.log(
        "Loading system stats - admin ready and accessible IDs loaded"
      );
      fetchSystemStats();
    }
  }, [currentAdmin, accessibleUserIdsLoaded, fetchSystemStats]); // Stable dependencies

  // EFFECT 4: Update security stats when sessions change
  useEffect(() => {
    setSecurityStats((prev) => ({
      ...prev,
      activeAdminSessions: activeSessions.length,
      totalLoginAttempts: loginAttempts.length,
      successfulLogins: loginAttempts.filter((a) => a.success).length,
    }));
  }, [loginAttempts, activeSessions]);

  // EFFECT 5: Set up real-time subscription for system stats
  useEffect(() => {
    if (!currentAdmin || !accessibleUserIdsLoaded) return;

    const subscription = supabase
      .channel("admin_system_stats")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
        },
        () => {
          fetchSystemStats();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deposits",
        },
        () => {
          fetchSystemStats();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentAdmin, accessibleUserIdsLoaded, fetchSystemStats]);

  // Loading state
  if (loadingPermissions) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading admin dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No admin session
  if (!currentAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
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
            <Button
              onClick={onLogout}
              className="bg-[#F26623] hover:bg-[#E55A1F]"
            >
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PresenceManager />

      {/* Enhanced Header with Current User's Location and Hierarchy Info */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div>
                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  <span>Your Session: {sessionId.slice(0, 8)}...</span>
                  <div
                    className={`flex items-center ${getSessionStatusColor()}`}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    <span>{formatTimeRemaining(sessionTimeLeft)}</span>
                  </div>
                  <div className="flex items-center">
                    <Globe className="w-3 h-3 mr-1" />
                    <span>Your IP: {locationInfo.ip}</span>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-3 h-3 mr-1" />
                    <span>Your Location: {locationInfo.country}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Admin Level Badge */}
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
              <Button
                variant="outline"
                size="sm"
                onClick={onLogout}
                className="text-red-600 border-red-200 hover:bg-red-50 bg-transparent"
              >
                Secure Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-36">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="presence" className="flex items-center">
              <Wifi className="w-4 h-4 mr-2" />
              Presence
            </TabsTrigger>
            <TabsTrigger
              value="UnifiedAdminPanel"
              className="flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Manage Users
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="kyc" className="flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              KYC
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center">
              <Mail className="w-4 h-4 mr-2" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="hierarchy" className="flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              Hierarchy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="UnifiedAdminPanel">
            <UnifiedAdminPanel />
          </TabsContent>

          <TabsContent value="presence">
            <UserPresenceTracker />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityManager />
          </TabsContent>

          <TabsContent value="kyc">
            <KYCAdminPanel />
          </TabsContent>

          <TabsContent value="messages">
            <MessageManager />
          </TabsContent>

          <TabsContent value="users">
            <UserManagementTest />
          </TabsContent>

          <TabsContent value="hierarchy">
            <UserHierarchyManager />
          </TabsContent>

          <TabsContent value="database">
            <DatabaseTest />
          </TabsContent>
        </Tabs>
        <LiveChatAdmin />
      </div>
    </div>
  );
}
