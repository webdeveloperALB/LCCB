import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Download,
  User,
  FileText,
  MapPin,
  Search,
  SkipForward,
  Loader2,
  Shield,
  Crown,
  UserCheck,
  AlertTriangle,
} from "lucide-react";

interface KYCRecord {
  id: string;
  user_id: string;
  full_name: string;
  status: string;
  submitted_at: string;
  document_type: string;
  document_number: string;
  date_of_birth: string;
  address: string;
  city: string;
  country: string;
  postal_code?: string;
  id_document_path: string;
  utility_bill_path: string;
  selfie_path: string;
  driver_license_path?: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

interface UserInterface {
  id: string;
  email: string;
  full_name?: string;
  kyc_status: string;
  created_at: string;
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

export default function KYCAdminPanel() {
  // Core state
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [accessibleUserIds, setAccessibleUserIds] = useState<string[]>([]);
  const [accessibleUserIdsLoaded, setAccessibleUserIdsLoaded] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  // KYC state
  const [kycRecords, setKycRecords] = useState<KYCRecord[]>([]);
  const [searchResults, setSearchResults] = useState<UserInterface[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserInterface | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [totalStats, setTotalStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
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

      console.log("Getting accessible users for KYC admin:", admin);

      // Full admin (is_admin: true, is_superiormanager: false, is_manager: false) - can see everyone
      if (admin.is_admin && !admin.is_superiormanager && !admin.is_manager) {
        console.log("Full admin - can see all KYC records");
        return []; // Empty array means no filter (see all)
      }

      // Superior manager (is_admin: true, is_superiormanager: true) - can see their managers and their assigned users
      if (admin.is_admin && admin.is_superiormanager) {
        console.log(
          "Superior manager loading accessible users for KYC:",
          admin.id
        );

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
                "Superior manager can access KYC for (verified):",
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
        console.log("Manager loading accessible users for KYC:", admin.id);

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
          console.log("Manager's assigned user IDs for KYC:", assignedUserIds);

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
              "Manager can access KYC for (verified users only):",
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
      return "Full Administrator - Can manage all KYC records";
    }
    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      return "Superior Manager - Can manage KYC for assigned managers and their users";
    }
    if (currentAdmin.is_manager) {
      return "Manager - Can manage KYC for assigned users only";
    }
    return "No admin permissions";
  }, [currentAdmin]);

  // Fetch total counts with hierarchy filtering - STABLE FUNCTION
  const fetchTotalCounts = useCallback(async () => {
    if (!currentAdmin || !accessibleUserIdsLoaded) {
      console.log(
        "Cannot fetch total counts - admin or accessible IDs not ready"
      );
      return;
    }

    try {
      console.log("Fetching total KYC counts for admin:", currentAdmin);

      // For count queries, we need to fetch data first then count
      let query = supabase.from("kyc_verifications").select("user_id, status");

      // Apply hierarchy-based filtering
      console.log(
        "Using cached accessible user IDs for counts:",
        accessibleUserIds
      );

      if (accessibleUserIds.length > 0) {
        console.log(
          "Filtering total counts to accessible user IDs:",
          accessibleUserIds
        );
        query = query.in("user_id", accessibleUserIds);
      } else if (
        currentAdmin.is_admin &&
        !currentAdmin.is_superiormanager &&
        !currentAdmin.is_manager
      ) {
        // Full admin sees all records - no filter needed
        console.log("Full admin - loading all counts");
      } else {
        // No accessible users
        console.log("No accessible users for counts");
        query = query.eq("user_id", "00000000-0000-0000-0000-000000000000");
      }

      const { data: kycData, error } = await query;

      if (error) {
        console.error("Error fetching KYC data for counts:", error);
        return;
      }

      // Count the results manually
      const totalCount = kycData?.length || 0;
      const pendingCount =
        kycData?.filter((record) => record.status === "pending").length || 0;
      const approvedCount =
        kycData?.filter((record) => record.status === "approved").length || 0;
      const rejectedCount =
        kycData?.filter((record) => record.status === "rejected").length || 0;

      setTotalStats({
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      });

      console.log("Total KYC counts loaded:", {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      });
    } catch (error) {
      console.error("Error fetching total KYC counts:", error);
    }
  }, [currentAdmin, accessibleUserIds, accessibleUserIdsLoaded]);

  // User search with hierarchy filtering
  useEffect(() => {
    if (
      !currentAdmin ||
      !accessibleUserIdsLoaded ||
      userSearchTerm.length < 2
    ) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        console.log(
          "Searching users for KYC skip with hierarchy:",
          userSearchTerm
        );

        let query = supabase
          .from("users")
          .select(
            "id, email, full_name, kyc_status, created_at, is_admin, is_manager, is_superiormanager"
          )
          .or(
            `email.ilike.%${userSearchTerm}%,full_name.ilike.%${userSearchTerm}%`
          )
          .neq("kyc_status", "approved");

        // Apply hierarchy filtering
        if (accessibleUserIds.length > 0) {
          console.log(
            "Filtering user search to accessible user IDs:",
            accessibleUserIds
          );
          query = query.in("id", accessibleUserIds);
        } else if (
          currentAdmin.is_admin &&
          !currentAdmin.is_superiormanager &&
          !currentAdmin.is_manager
        ) {
          // Full admin sees everyone - no filter needed
          console.log("Full admin user search - no filter applied");
        } else {
          // No accessible users
          console.log("No accessible users for search");
          query = query.eq("id", "00000000-0000-0000-0000-000000000000"); // No results
        }

        const { data, error } = await query
          .limit(10)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setSearchResults(data);
          console.log(`Found ${data.length} accessible users for KYC skip`);
        } else {
          console.error("User search error:", error);
          setSearchResults([]);
        }
      } catch (error) {
        console.error("User search failed:", error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    userSearchTerm,
    currentAdmin,
    accessibleUserIds,
    accessibleUserIdsLoaded,
  ]);

  // Fetch KYC records with hierarchy filtering
  const fetchKYCRecords = useCallback(async () => {
    if (!currentAdmin || !accessibleUserIdsLoaded) {
      console.log(
        "Cannot fetch KYC records - admin or accessible IDs not ready"
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log("Fetching KYC records for search term:", searchTerm);

      let kycData = [];
      let query = supabase.from("kyc_verifications").select("*");

      // Apply hierarchy filtering first
      if (accessibleUserIds.length > 0) {
        console.log(
          "Filtering KYC records to accessible user IDs:",
          accessibleUserIds
        );
        query = query.in("user_id", accessibleUserIds);
      } else if (
        currentAdmin.is_admin &&
        !currentAdmin.is_superiormanager &&
        !currentAdmin.is_manager
      ) {
        // Full admin sees all KYC records - no filter needed
        console.log("Full admin - loading all KYC records");
      } else {
        // No accessible users
        console.log("No accessible users for KYC records");
        setKycRecords([]);
        setStats({ total: 0, pending: 0, approved: 0, rejected: 0 });
        setLoading(false);
        return;
      }

      if (searchTerm.length >= 2) {
        console.log("Searching KYC records...");
        query = query.or(
          `full_name.ilike.%${searchTerm}%,document_number.ilike.%${searchTerm}%`
        );
      }

      if (activeTab !== "all") {
        query = query.eq("status", activeTab);
      }

      // Apply limits based on search
      if (searchTerm.length >= 2) {
        query = query.limit(20);
      } else if (activeTab === "pending") {
        query = query.limit(10);
      } else if (activeTab !== "all") {
        query = query.limit(20);
      } else {
        query = query.limit(50);
      }

      const { data, error } = await query.order("submitted_at", {
        ascending: false,
      });

      if (error) throw error;
      kycData = data || [];

      setKycRecords(kycData);

      const loadedStats = {
        total: kycData.length,
        pending: kycData.filter((r: any) => r.status === "pending").length,
        approved: kycData.filter((r: any) => r.status === "approved").length,
        rejected: kycData.filter((r: any) => r.status === "rejected").length,
      };
      setStats(loadedStats);

      console.log(`Loaded ${kycData.length} KYC records for admin`);
    } catch (error: any) {
      console.error("Error in fetchKYCRecords:", error);
      setError(`Failed to load KYC records: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [
    currentAdmin,
    accessibleUserIds,
    accessibleUserIdsLoaded,
    searchTerm,
    activeTab,
  ]);

  // Update KYC status with permission check
  const updateKYCStatus = async (
    userId: string,
    kycId: string,
    newStatus: string,
    rejectionReason?: string
  ) => {
    if (!currentAdmin) {
      setProcessingError("Admin session not found");
      return;
    }

    // Check if admin can manage this user's KYC
    const canManageKYC =
      accessibleUserIds.length === 0 || // Full admin
      accessibleUserIds.includes(userId); // User is accessible

    if (!canManageKYC) {
      setProcessingError("You don't have permission to manage this user's KYC");
      return;
    }

    try {
      setUpdating(kycId);
      setProcessingError(null);

      const updateData: any = {
        status: newStatus,
        reviewed_at: new Date().toISOString(),
      };

      if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { error: kycError } = await supabase
        .from("kyc_verifications")
        .update(updateData)
        .eq("id", kycId);

      if (kycError) throw kycError;

      const { error: userError } = await supabase
        .from("users")
        .update({ kyc_status: newStatus })
        .eq("id", userId);

      if (userError) throw userError;

      await fetchKYCRecords();
      await fetchTotalCounts();
      alert(`KYC ${newStatus} successfully!`);
    } catch (error: any) {
      console.error("Error updating KYC status:", error);
      setProcessingError(`Error updating KYC status: ${error.message}`);
      alert(`Error updating KYC status: ${error.message}`);
    } finally {
      setUpdating(null);
    }
  };

  // Skip KYC with permission check
  const skipKYCForUser = async (userId: string) => {
    if (!currentAdmin) {
      setProcessingError("Admin session not found");
      return;
    }

    // Check if admin can skip KYC for this user
    const canSkipKYC =
      accessibleUserIds.length === 0 || // Full admin
      accessibleUserIds.includes(userId); // User is accessible

    if (!canSkipKYC) {
      setProcessingError("You don't have permission to skip KYC for this user");
      return;
    }

    try {
      setUpdating(userId);
      setProcessingError(null);

      const { data: existingKyc, error: checkError } = await supabase
        .from("kyc_verifications")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingKyc) {
        await updateKYCStatus(
          userId,
          existingKyc.id,
          "approved",
          "KYC SKIPPED BY ADMIN"
        );
        setShowSkipDialog(false);
        setSelectedUser(null);
        return;
      }

      const { data: user, error: userFetchError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userFetchError) throw new Error("User not found");

      const kycData = {
        user_id: userId,
        full_name: user.full_name || user.email.split("@")[0],
        status: "approved",
        submitted_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        document_type: "passport",
        document_number: "ADMIN_SKIP",
        date_of_birth: "2000-01-01",
        address: "Admin Skip",
        city: "Admin Skip",
        country: "Admin Skip",
        postal_code: "00000",
        id_document_path: "admin_skip/no_document",
        utility_bill_path: "admin_skip/no_document",
        selfie_path: "admin_skip/no_document",
        rejection_reason:
          "KYC SKIPPED BY ADMIN - No verification documents required",
      };

      const { error: kycError } = await supabase
        .from("kyc_verifications")
        .insert(kycData);

      if (kycError) throw kycError;

      const { error: userError } = await supabase
        .from("users")
        .update({ kyc_status: "approved" })
        .eq("id", userId);

      if (userError) throw userError;

      await fetchKYCRecords();
      await fetchTotalCounts();
      setShowSkipDialog(false);
      setSelectedUser(null);
      alert("KYC successfully skipped for user!");
    } catch (error: any) {
      console.error("Error skipping KYC:", error);
      setProcessingError(`Error skipping KYC: ${error.message}`);
      alert(`Error skipping KYC: ${error.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleReject = (userId: string, kycId: string) => {
    const reason = prompt("Please provide a reason for rejection:");
    if (reason) {
      updateKYCStatus(userId, kycId, "rejected", reason);
    }
  };

  const handleSkipKYC = (user: UserInterface) => {
    setSelectedUser(user);
    setShowSkipDialog(true);
  };

  const downloadDocument = async (path: string, filename: string) => {
    try {
      if (path.includes("admin_skip") || path.includes("no_document")) {
        return;
      }

      let cleanPath = path.trim();
      if (cleanPath.startsWith("/")) {
        cleanPath = cleanPath.substring(1);
      }

      const fileName = cleanPath.split("/").pop();
      if (!fileName) {
        alert("Invalid file path - could not extract filename");
        return;
      }

      const { data, error } = await supabase.storage
        .from("kyc-documents")
        .download(cleanPath);

      if (error) {
        const { data: signedUrlData, error: urlError } = await supabase.storage
          .from("kyc-documents")
          .createSignedUrl(cleanPath, 60);

        if (urlError) throw urlError;

        if (signedUrlData?.signedUrl) {
          const response = await fetch(signedUrlData.signedUrl);
          if (!response.ok) throw new Error("Download failed");

          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error: any) {
      console.error("Download error:", error);
      alert(`Download failed: ${error.message}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "approved":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Get role badges for user
  const getRoleBadges = useCallback((user: UserInterface) => {
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

  const filteredRecords = kycRecords.filter((record) => {
    const matchesSearch =
      searchTerm === "" ||
      record.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

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
        console.error("Failed to initialize KYC admin:", error);
        if (mounted) {
          setError("Failed to load admin permissions");
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
        console.log("Loading accessible user IDs for KYC admin:", currentAdmin);
        const userIds = await loadAccessibleUserIds(currentAdmin);
        if (mounted) {
          setAccessibleUserIds(userIds);
          setAccessibleUserIdsLoaded(true);
          console.log("Cached accessible user IDs for KYC:", userIds);
        }
      } catch (error) {
        console.error("Failed to load accessible users for KYC:", error);
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
      console.log("Loading KYC data - admin ready and accessible IDs loaded");
      fetchTotalCounts();
      fetchKYCRecords();
    }
  }, [
    currentAdmin,
    accessibleUserIdsLoaded,
    fetchTotalCounts,
    fetchKYCRecords,
  ]); // Stable dependencies

  // EFFECT 4: Refetch when tab changes
  useEffect(() => {
    if (currentAdmin && accessibleUserIdsLoaded) {
      fetchKYCRecords();
    }
  }, [activeTab, currentAdmin, accessibleUserIdsLoaded, fetchKYCRecords]);

  // EFFECT 5: Search with debounce
  useEffect(() => {
    if (!currentAdmin || !accessibleUserIdsLoaded) return;

    const timeoutId = setTimeout(() => {
      fetchKYCRecords();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, currentAdmin, accessibleUserIdsLoaded, fetchKYCRecords]);

  function renderKYCRecords() {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (kycRecords.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm.length >= 2
                ? `No KYC records found matching "${searchTerm}"`
                : activeTab === "pending"
                ? "No pending KYC records"
                : `Type 2+ characters to search ${
                    totalStats[activeTab as keyof typeof totalStats]
                  } ${activeTab} records`}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              {searchTerm.length < 2 && activeTab !== "pending"
                ? "Use the search box above to find specific records"
                : "KYC submissions will appear here when users complete verification"}
            </p>
            {currentAdmin?.is_manager && (
              <p className="text-xs text-blue-600 mt-2">
                You can only see KYC records for users assigned to you
              </p>
            )}
            {currentAdmin?.is_admin && currentAdmin?.is_superiormanager && (
              <p className="text-xs text-purple-600 mt-2">
                You can see KYC records for managers you assigned and their
                users
              </p>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {kycRecords.map((record) => (
          <Card key={record.id} className="overflow-hidden">
            <CardHeader className="bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#F26623] rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      {record.full_name}
                    </CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm text-gray-600">
                        User ID: {record.user_id.slice(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(record.status)}
                  {getStatusBadge(record.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">
                        Document Type:
                      </span>
                      <p className="capitalize">
                        {record.document_type.replace("_", " ")}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        Document Number:
                      </span>
                      <p>{record.document_number}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        Date of Birth:
                      </span>
                      <p>
                        {new Date(record.date_of_birth).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        Submitted:
                      </span>
                      <p>
                        {new Date(record.submitted_at).toLocaleDateString()} at{" "}
                        {new Date(record.submitted_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <span className="font-medium text-gray-600">
                          Address:
                        </span>
                        <p className="text-sm">{record.address}</p>
                        <p className="text-sm text-gray-600">
                          {record.city}, {record.country}
                          {record.postal_code && ` ${record.postal_code}`}
                        </p>
                      </div>
                    </div>
                  </div>
                  {record.rejection_reason && (
                    <div
                      className={`p-3 border rounded-md ${
                        record.rejection_reason.includes("SKIPPED BY ADMIN")
                          ? "bg-blue-50 border-blue-200"
                          : "bg-red-50 border-red-200"
                      }`}
                    >
                      <span
                        className={`font-medium ${
                          record.rejection_reason.includes("SKIPPED BY ADMIN")
                            ? "text-blue-800"
                            : "text-red-800"
                        }`}
                      >
                        {record.rejection_reason.includes("SKIPPED BY ADMIN")
                          ? "Admin Note:"
                          : "Rejection Reason:"}
                      </span>
                      <p
                        className={`text-sm mt-1 ${
                          record.rejection_reason.includes("SKIPPED BY ADMIN")
                            ? "text-blue-700"
                            : "text-red-700"
                        }`}
                      >
                        {record.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>

                {/* Documents */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Uploaded Documents
                  </h3>
                  {record.document_number === "ADMIN_SKIP" ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-center">
                      <SkipForward className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <p className="text-blue-800 font-medium">
                        KYC Skipped by Admin
                      </p>
                      <p className="text-sm text-blue-600 mt-1">
                        No documents required for this verification
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <span className="text-sm font-medium">ID Document</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            downloadDocument(
                              record.id_document_path,
                              `${record.full_name}_ID_Document`
                            )
                          }
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <span className="text-sm font-medium">
                          Utility Bill
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            downloadDocument(
                              record.utility_bill_path,
                              `${record.full_name}_Utility_Bill`
                            )
                          }
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <span className="text-sm font-medium">Selfie</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            downloadDocument(
                              record.selfie_path,
                              `${record.full_name}_Selfie`
                            )
                          }
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                      {record.driver_license_path && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                          <span className="text-sm font-medium">
                            Driver License
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              downloadDocument(
                                record.driver_license_path!,
                                `${record.full_name}_Driver_License`
                              )
                            }
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              {record.status === "pending" && (
                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                  <Button
                    onClick={() => handleReject(record.user_id, record.id)}
                    variant="destructive"
                    disabled={updating === record.id}
                  >
                    {updating === record.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      "Reject"
                    )}
                  </Button>
                  <Button
                    onClick={() =>
                      updateKYCStatus(record.user_id, record.id, "approved")
                    }
                    className="bg-green-600 hover:bg-green-700"
                    disabled={updating === record.id}
                  >
                    {updating === record.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      "Approve"
                    )}
                  </Button>
                </div>
              )}
              {record.status !== "pending" && record.reviewed_at && (
                <div className="mt-4 pt-4 border-t text-sm text-gray-500">
                  Status updated on{" "}
                  {new Date(record.reviewed_at).toLocaleDateString()} at{" "}
                  {new Date(record.reviewed_at).toLocaleTimeString()}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

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
            You need admin or manager permissions to manage KYC records.
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            KYC Administration
          </h1>
        </div>
        <Button onClick={fetchKYCRecords} variant="outline" disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {processingError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{processingError}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Records
                </p>
                <p className="text-2xl font-bold">{totalStats.total}</p>
                <p className="text-xs text-gray-500">
                  {hasFullAdminAccess
                    ? "All KYC submissions"
                    : "Your accessible KYC records"}
                </p>
              </div>
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Pending Review
                </p>
                <p className="text-2xl font-bold text-yellow-600">
                  {totalStats.pending}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {totalStats.approved}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-red-600">
                  {totalStats.rejected}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder={
            hasFullAdminAccess
              ? "Search KYC records by name or document number (type 2+ characters)..."
              : currentAdmin.is_admin && currentAdmin.is_superiormanager
              ? "Search KYC records for your assigned managers and their users..."
              : "Search KYC records for your assigned users..."
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({totalStats.pending})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({totalStats.approved})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({totalStats.rejected})
          </TabsTrigger>
          <TabsTrigger value="all">All ({totalStats.total})</TabsTrigger>
          <TabsTrigger value="skip-kyc">Skip KYC</TabsTrigger>
        </TabsList>

        <TabsContent value="skip-kyc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <SkipForward className="w-5 h-5 mr-2" />
                Skip KYC for Users
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Search Users Without KYC
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder={
                      hasFullAdminAccess
                        ? "Type name or email to find users..."
                        : currentAdmin.is_admin &&
                          currentAdmin.is_superiormanager
                        ? "Search your assigned managers and their users..."
                        : "Search your assigned users..."
                    }
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>
              </div>

              {userSearchTerm.length >= 2 && (
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    searchResults.map((user) => {
                      const roles = getRoleBadges(user);
                      return (
                        <div
                          key={user.id}
                          className="p-4 border-b last:border-b-0 flex items-center justify-between hover:bg-gray-50"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {user.full_name ||
                                  user.email?.split("@")[0] ||
                                  "Unknown"}
                              </p>
                              <p className="text-sm text-gray-600">
                                {user.email}
                              </p>
                              <div className="flex items-center space-x-1 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {user.kyc_status || "No KYC"}
                                </Badge>
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
                          <Button
                            onClick={() => handleSkipKYC(user)}
                            variant="outline"
                            size="sm"
                            disabled={updating === user.id}
                          >
                            {updating === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <SkipForward className="w-4 h-4 mr-1" />
                                Skip KYC
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })
                  ) : !searching ? (
                    <div className="p-4 text-center text-gray-500">
                      No users found matching "{userSearchTerm}"
                      {currentAdmin.is_manager && (
                        <p className="text-xs text-blue-600 mt-1">
                          You can only search users assigned to you
                        </p>
                      )}
                      {currentAdmin.is_admin &&
                        currentAdmin.is_superiormanager && (
                          <p className="text-xs text-purple-600 mt-1">
                            You can search managers you assigned and their users
                          </p>
                        )}
                    </div>
                  ) : null}
                </div>
              )}

              {userSearchTerm.length > 0 && userSearchTerm.length < 2 && (
                <p className="text-xs text-gray-500">
                  Type at least 2 characters to search
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">{renderKYCRecords()}</TabsContent>
        <TabsContent value="approved">{renderKYCRecords()}</TabsContent>
        <TabsContent value="rejected">{renderKYCRecords()}</TabsContent>
        <TabsContent value="all">{renderKYCRecords()}</TabsContent>
      </Tabs>

      {/* Skip KYC Dialog */}
      <Dialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip KYC Verification</DialogTitle>
            <DialogDescription>
              Are you sure you want to skip KYC verification for this user? This
              will mark their KYC status as approved without requiring
              documents.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">
                    {selectedUser.full_name ||
                      selectedUser.email?.split("@")[0] ||
                      "Unknown"}
                  </p>
                  <p className="text-sm text-gray-600">{selectedUser.email}</p>
                  <div className="flex space-x-1 mt-1">
                    {getRoleBadges(selectedUser).map((role, index) => (
                      <Badge key={index} className={`text-xs ${role.color}`}>
                        {role.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSkipDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedUser && skipKYCForUser(selectedUser.id)}
              disabled={updating === selectedUser?.id}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updating === selectedUser?.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Skip KYC"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
