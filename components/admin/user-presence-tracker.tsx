"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import {
  Users,
  Circle,
  Clock,
  Wifi,
  WifiOff,
  MapPin,
  Globe,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  updated_at: string;
  ip_address?: string;
  country?: string;
  country_code?: string;
  city?: string;
  region?: string;
  user_email?: string;
  user_name?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

export default function UserPresenceTracker() {
  const [userPresences, setUserPresences] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [countryStats, setCountryStats] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");

  const updateStatistics = useCallback((presences: UserPresence[]) => {
    const online = presences.filter((p) => p.is_online).length;
    setOnlineCount(online);
    setTotalUsers(presences.length);

    const countries: Record<string, number> = {};
    presences
      .filter((p) => p.is_online && p.country)
      .forEach((p) => {
        countries[p.country!] = (countries[p.country!] || 0) + 1;
      });
    setCountryStats(countries);
  }, []);

  const handlePresenceUpdate = useCallback(async (payload: any) => {
    console.log("Real-time presence update:", payload);

    if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
      const updatedPresence = payload.new;

      let userInfo = {};
      try {
        const { data: userData } = await supabase
          .from("users")
          .select("email, first_name, last_name, full_name")
          .eq("id", updatedPresence.user_id)
          .single();

        if (userData) {
          userInfo = {
            user_email: userData.email,
            user_name:
              userData.full_name ||
              `${userData.first_name || ""} ${userData.last_name || ""}`.trim(),
            first_name: userData.first_name,
            last_name: userData.last_name,
            full_name: userData.full_name,
          };
        } else {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", updatedPresence.user_id)
            .single();

          userInfo = {
            user_email: profileData?.email || "Unknown",
            user_name: profileData?.full_name || "Unknown User",
          };
        }
      } catch (error) {
        console.error("Error fetching user info:", error);
      }

      const presenceWithUserInfo = { ...updatedPresence, ...userInfo };

      setUserPresences((prev) => {
        const existingIndex = prev.findIndex(
          (p) => p.user_id === updatedPresence.user_id
        );
        let newPresences;

        if (existingIndex >= 0) {
          newPresences = [...prev];
          newPresences[existingIndex] = presenceWithUserInfo;
        } else {
          newPresences = [...prev, presenceWithUserInfo];
        }

        newPresences.sort((a, b) => {
          if (a.is_online !== b.is_online) {
            return b.is_online ? 1 : -1;
          }
          return (
            new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
          );
        });

        return newPresences;
      });
    } else if (payload.eventType === "DELETE") {
      setUserPresences((prev) =>
        prev.filter((p) => p.user_id !== payload.old.user_id)
      );
    }
  }, []);

  const fetchUserPresences = async () => {
    try {
      setLoading(true);

      const { data: presenceData, error: presenceError } = await supabase
        .from("user_presence")
        .select("*")
        .order("is_online", { ascending: false })
        .order("last_seen", { ascending: false });

      if (presenceError) {
        console.error("Error fetching presence data:", presenceError);
        throw presenceError;
      }

      if (!presenceData || presenceData.length === 0) {
        setUserPresences([]);
        setOnlineCount(0);
        setTotalUsers(0);
        return;
      }

      const presencesWithUserInfo = await Promise.all(
        presenceData.map(async (presence) => {
          const { data: userData } = await supabase
            .from("users")
            .select("email, first_name, last_name, full_name")
            .eq("id", presence.user_id)
            .single();

          if (userData) {
            return {
              ...presence,
              user_email: userData.email,
              user_name:
                userData.full_name ||
                `${userData.first_name || ""} ${
                  userData.last_name || ""
                }`.trim(),
              first_name: userData.first_name,
              last_name: userData.last_name,
              full_name: userData.full_name,
            };
          }

          const { data: profileData } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", presence.user_id)
            .single();

          return {
            ...presence,
            user_email: profileData?.email || "Unknown",
            user_name: profileData?.full_name || "Unknown User",
          };
        })
      );

      setUserPresences(presencesWithUserInfo);
      updateStatistics(presencesWithUserInfo);
    } catch (error) {
      console.error("Error fetching user presences:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserPresences();

    const presenceSubscription = supabase
      .channel("user_presence_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
        },
        handlePresenceUpdate
      )
      .subscribe();

    return () => {
      presenceSubscription.unsubscribe();
    };
  }, [handlePresenceUpdate]);

  useEffect(() => {
    updateStatistics(userPresences);
  }, [userPresences, updateStatistics]);

  const formatLastSeen = (lastSeen: string) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInSeconds = Math.floor(
      (now.getTime() - lastSeenDate.getTime()) / 1000
    );

    if (diffInSeconds < 30) return "Just now";
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  const getStatusBadge = (isOnline: boolean) => {
    return isOnline ? (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <Circle className="w-2 h-2 mr-1 fill-current" />
        Online
      </Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-600 border-gray-200">
        <Circle className="w-2 h-2 mr-1 fill-current" />
        Offline
      </Badge>
    );
  };

  const getCountryFlag = (countryCode: string) => {
    if (!countryCode) return "🌍";
    return String.fromCodePoint(
      ...[...countryCode.toUpperCase()].map((x) => 0x1f1a5 + x.charCodeAt(0))
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Real-Time User Presence with Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center space-x-4 p-3 border rounded-lg animate-pulse"
              >
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
                <div className="w-16 h-6 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Country Statistics */}
      {Object.keys(countryStats).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              Online Users by Country
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(countryStats)
                .sort(([, a], [, b]) => b - a)
                .map(([country, count]) => (
                  <div
                    key={country}
                    className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg"
                  >
                    <span className="text-lg">🌍</span>
                    <div>
                      <p className="font-medium text-sm">{country}</p>
                      <p className="text-xs text-gray-500">
                        {count} user{count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Presence List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Real-Time User Presence with Location
            <Badge variant="outline" className="ml-2 text-xs">
              Live
            </Badge>
          </CardTitle>
          <div className="mt-4">
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(() => {
              const filteredPresences = userPresences.filter((presence) => {
                const searchLower = searchTerm.toLowerCase();
                const nameMatch = (presence.user_name || "")
                  .toLowerCase()
                  .includes(searchLower);
                const emailMatch = (presence.user_email || "")
                  .toLowerCase()
                  .includes(searchLower);
                return nameMatch || emailMatch;
              });

              if (filteredPresences.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">
                      {searchTerm
                        ? `No users found matching "${searchTerm}"`
                        : "No users found"}
                    </p>
                  </div>
                );
              }

              return filteredPresences.map((presence) => (
                <div
                  key={presence.user_id}
                  className={`flex items-center justify-between p-4 border rounded-lg transition-all duration-200 ${
                    presence.is_online
                      ? "hover:bg-green-50 border-green-200 bg-green-25"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                        <Users className="h-6 w-6 text-gray-500" />
                      </div>
                      <div
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white transition-colors duration-200 ${
                          presence.is_online
                            ? "bg-green-500 animate-pulse"
                            : "bg-gray-400"
                        }`}
                      ></div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {presence.user_name ||
                          presence.user_email ||
                          "Unknown User"}
                      </p>
                      <p className="text-xs text-gray-500 mb-1">
                        {presence.user_email}
                      </p>

                      {/* Location Information - WORKING VERSION */}
                      {presence.is_online && (
                        <div className="space-y-1">
                          {presence.ip_address && (
                            <div className="flex items-center space-x-2 text-xs bg-blue-50 p-2 rounded">
                              <MapPin className="h-3 w-3 text-blue-500" />
                              <span className="font-mono text-blue-700">
                                IP: {presence.ip_address}
                              </span>
                            </div>
                          )}
                          {presence.country && (
                            <div className="flex items-center space-x-2 text-xs bg-green-50 p-2 rounded">
                              <Globe className="h-3 w-3 text-green-500" />
                              <span className="text-green-700">
                                {getCountryFlag(presence.country_code || "")}
                                {presence.city && presence.city !== "Unknown"
                                  ? `${presence.city}, `
                                  : ""}
                                {presence.country}
                              </span>
                            </div>
                          )}
                          {!presence.ip_address && !presence.country && (
                            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                              Location data not available
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center space-x-2 mt-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {presence.is_online
                            ? "Active now"
                            : `Last seen ${formatLastSeen(presence.last_seen)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(presence.is_online)}
                  </div>
                </div>
              ));
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
