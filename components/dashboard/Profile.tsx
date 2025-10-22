import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  User,
  Lock,
  Mail,
  Calendar,
  Shield,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface ProfileProps {
  userProfile: any;
}

interface UserData {
  id: string;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  age: number;
  client_id: string;
  kyc_status: string;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
  created_at: string;
}

export default function Profile({ userProfile }: ProfileProps) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: usersData } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      setUserData({
        id: user.id,
        email: user.email || profilesData?.email || usersData?.email || "",
        full_name: usersData?.full_name || profilesData?.full_name || "",
        first_name: usersData?.first_name || "",
        last_name: usersData?.last_name || "",
        age: usersData?.age || profilesData?.age || 0,
        client_id: profilesData?.client_id || "",
        kyc_status: usersData?.kyc_status || "not_started",
        is_admin: usersData?.is_admin || false,
        is_manager: usersData?.is_manager || false,
        is_superiormanager: usersData?.is_superiormanager || false,
        created_at: usersData?.created_at || profilesData?.created_at || "",
      });
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long");
      return;
    }

    setIsChangingPassword(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPasswordError("User not authenticated");
        setIsChangingPassword(false);
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;
      const { error: authError } = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${user.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
          body: JSON.stringify({
            password: passwordData.newPassword,
          }),
        }
      ).then((res) => res.json());

      if (authError) {
        setPasswordError(
          authError.message || "Failed to update password in auth"
        );
        setIsChangingPassword(false);
        return;
      }

      await supabase
        .from("users")
        .update({ password: passwordData.newPassword })
        .eq("id", user.id);

      await supabase
        .from("profiles")
        .update({
          password: passwordData.newPassword,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      setPasswordSuccess("Password updated successfully in all systems");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: any) {
      setPasswordError(error.message || "Failed to update password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getRoleLabel = () => {
    if (userData?.is_superiormanager) return "Superior Manager";
    if (userData?.is_manager) return "Manager";
    if (userData?.is_admin) return "Admin";
    return "Client";
  };

  const getKycStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-600 bg-green-50";
      case "pending":
        return "text-yellow-600 bg-yellow-50";
      case "rejected":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-[#0A7F8D] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Profile</h1>

      <div className="bg-white rounded-2xl shadow-sm p-8 mb-6">
        <div className="flex items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">
              {userData?.full_name
                ? userData.full_name
                    .toLowerCase()
                    .split(" ")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")
                : "User"}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-center">
            <Mail className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-gray-800 font-medium">
                {userData?.email || "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <Calendar className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Age</p>
              <p className="text-gray-800 font-medium">
                {userData?.age || "N/A"}
              </p>
            </div>
          </div>

          {userData?.first_name && (
            <div className="flex items-center">
              <User className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm text-gray-500">First Name</p>
                <p className="text-gray-800 font-medium">
                  {userData.first_name
                    ? userData.first_name.charAt(0).toUpperCase() +
                      userData.first_name.slice(1).toLowerCase()
                    : ""}
                </p>
              </div>
            </div>
          )}

          {userData?.last_name && (
            <div className="flex items-center">
              <User className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm text-gray-500">Last Name</p>
                <p className="text-gray-800 font-medium">
                  {userData.last_name
                    ? userData.last_name.charAt(0).toUpperCase() +
                      userData.last_name.slice(1).toLowerCase()
                    : ""}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center">
            <Calendar className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Member Since</p>
              <p className="text-gray-800 font-medium">
                {userData?.created_at
                  ? new Date(userData.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
          <Lock className="w-5 h-5 mr-2" />
          Change Password
        </h3>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label
              htmlFor="current-password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) =>
                setPasswordData({
                  ...passwordData,
                  currentPassword: e.target.value,
                })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7F8D] focus:border-transparent"
              required
            />
          </div>

          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={passwordData.newPassword}
              onChange={(e) =>
                setPasswordData({
                  ...passwordData,
                  newPassword: e.target.value,
                })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7F8D] focus:border-transparent"
              required
              minLength={6}
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) =>
                setPasswordData({
                  ...passwordData,
                  confirmPassword: e.target.value,
                })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7F8D] focus:border-transparent"
              required
              minLength={6}
            />
          </div>

          {passwordError && (
            <div className="flex items-center p-4 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="flex items-center p-4 bg-green-50 text-green-700 rounded-lg">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={isChangingPassword}
            className="w-full bg-[#0A7F8D] hover:bg-[#0A7F8D]/90 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {isChangingPassword ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Updating Password...
              </div>
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
