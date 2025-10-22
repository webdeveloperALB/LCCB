"use client";

import { useState, useEffect, useRef } from "react";
import { supabase, type User } from "../../lib/supabase";
import AdminDashboard from "@/components/admin/admin-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye,
  EyeOff,
  Shield,
  AlertTriangle,
  Clock,
  Lock,
  Monitor,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LoginAttempt {
  timestamp: number;
  success: boolean;
  ip: string;
  country: string;
  sessionId?: string;
}

interface SecurityState {
  failedAttempts: number;
  lockoutUntil: number | null;
  lastActivity: number;
  sessionId: string;
  sessionStartTime: number;
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

// Global session storage for multi-user support
const GLOBAL_SESSIONS_KEY = "admin_sessions";
const SESSION_STORAGE_KEY = "current_admin_session";

export default function SecureAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [securityState, setSecurityState] = useState<SecurityState>({
    failedAttempts: 0,
    lockoutUntil: null,
    lastActivity: Date.now(),
    sessionId: "",
    sessionStartTime: 0,
  });
  const [sessionTimeLeft, setSessionTimeLeft] = useState(0);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [activeSessions, setActiveSessions] = useState<AdminSession[]>([]);

  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionSyncRef = useRef<NodeJS.Timeout | null>(null);

  // Security configuration
  const SECURITY_CONFIG = {
    maxFailedAttempts: 3,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    inactivityTimeout: 10 * 60 * 1000, // 10 minutes
    rateLimitWindow: 5 * 60 * 1000, // 5 minutes
    maxAttemptsPerWindow: 5,
  };

  // Generate secure session ID
  const generateSessionId = () => {
    return crypto.getRandomValues(new Uint32Array(4)).join("-");
  };

  // Generate user ID based on browser/device
  const generateUserId = () => {
    const userAgent = navigator.userAgent;
    const timestamp = Date.now();
    return btoa(`${userAgent}-${timestamp}`).slice(0, 16);
  };

  // Fetch real location data
  const fetchLocationData = async (): Promise<{
    ip: string;
    country: string;
    city: string;
  }> => {
    try {
      console.log("Login: Fetching real location data...");

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
          console.log("Login: Got IP from ipify:", ipData.ip);
        }
      } catch (error) {
        console.log("Login: ipify failed:", error);
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
            console.log("Login: Got IP from ipapi.co:", ipAddress);
          }
        } catch (error) {
          console.log("Login: ipapi.co IP failed:", error);
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
            ipAddress = ipData.origin.split(",")[0].trim();
            console.log("Login: Got IP from httpbin:", ipAddress);
          }
        } catch (error) {
          console.log("Login: httpbin failed:", error);
        }
      }

      // Now try to get location data if we have an IP
      if (ipAddress) {
        // Try multiple location services
        // Location Service 1: ipapi.co
        try {
          const locationResponse = await fetch(
            `https://ipapi.co/${ipAddress}/json/`,
            {
              signal: AbortSignal.timeout(4000),
            }
          );
          const locationData = await locationResponse.json();

          if (
            locationData &&
            !locationData.error &&
            locationData.country_name
          ) {
            console.log("Login: Got location from ipapi.co:", locationData);
            return {
              ip: ipAddress,
              country: locationData.country_name || "Unknown",
              city: locationData.city || "Unknown",
            };
          }
        } catch (error) {
          console.log("Login: ipapi.co location failed:", error);
        }

        // Location Service 2: ip-api.com
        try {
          const locationResponse = await fetch(
            `http://ip-api.com/json/${ipAddress}`,
            {
              signal: AbortSignal.timeout(4000),
            }
          );
          const locationData = await locationResponse.json();

          if (locationData && locationData.status === "success") {
            console.log("Login: Got location from ip-api.com:", locationData);
            return {
              ip: ipAddress,
              country: locationData.country || "Unknown",
              city: locationData.city || "Unknown",
            };
          }
        } catch (error) {
          console.log("Login: ip-api.com failed:", error);
        }

        // Location Service 3: ipinfo.io
        try {
          const locationResponse = await fetch(
            `https://ipinfo.io/${ipAddress}/json`,
            {
              signal: AbortSignal.timeout(4000),
            }
          );
          const locationData = await locationResponse.json();

          if (locationData && locationData.country) {
            console.log("Login: Got location from ipinfo.io:", locationData);
            return {
              ip: ipAddress,
              country: locationData.country || "Unknown",
              city: locationData.city || "Unknown",
            };
          }
        } catch (error) {
          console.log("Login: ipinfo.io failed:", error);
        }

        // If location services failed but we have IP
        return {
          ip: ipAddress,
          country: "Location unavailable",
          city: "Unknown",
        };
      }

      // If no IP could be determined
      return {
        ip: "IP detection failed",
        country: "Unable to determine",
        city: "Unknown",
      };
    } catch (error) {
      console.error("Login: Location fetch error:", error);
      return {
        ip: "Detection failed",
        country: "Service error",
        city: "Unknown",
      };
    }
  };

  // Global session management functions
  const getGlobalSessions = (): AdminSession[] => {
    if (typeof window === "undefined") return [];
    try {
      const sessions = localStorage.getItem(GLOBAL_SESSIONS_KEY);
      return sessions ? JSON.parse(sessions) : [];
    } catch {
      return [];
    }
  };

  const setGlobalSessions = (sessions: AdminSession[]) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(GLOBAL_SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error("Failed to save sessions:", error);
    }
  };

  const getCurrentSession = (): AdminSession | null => {
    if (typeof window === "undefined") return null;
    try {
      const session = localStorage.getItem(SESSION_STORAGE_KEY);
      return session ? JSON.parse(session) : null;
    } catch {
      return null;
    }
  };

  const setCurrentSession = (session: AdminSession | null) => {
    if (typeof window === "undefined") return;
    try {
      if (session) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Failed to save current session:", error);
    }
  };

  // Clean up expired sessions
  const cleanupExpiredSessions = () => {
    const now = Date.now();
    const sessions = getGlobalSessions();
    const activeSessions = sessions.filter((session) => {
      const isActive =
        now - session.lastActivity < SECURITY_CONFIG.sessionTimeout;
      return isActive;
    });

    setGlobalSessions(activeSessions);
    setActiveSessions(activeSessions);

    return activeSessions;
  };

  // Add or update session
  const addOrUpdateSession = (sessionData: AdminSession) => {
    const sessions = getGlobalSessions();
    const existingIndex = sessions.findIndex(
      (s) => s.sessionId === sessionData.sessionId
    );

    if (existingIndex >= 0) {
      sessions[existingIndex] = sessionData;
    } else {
      sessions.push(sessionData);
    }

    setGlobalSessions(sessions);
    setActiveSessions(sessions);
    setCurrentSession(sessionData);
  };

  // Remove session
  const removeSession = (sessionId: string) => {
    const sessions = getGlobalSessions();
    const filteredSessions = sessions.filter((s) => s.sessionId !== sessionId);

    setGlobalSessions(filteredSessions);
    setActiveSessions(filteredSessions);

    const currentSession = getCurrentSession();
    if (currentSession?.sessionId === sessionId) {
      setCurrentSession(null);
    }
  };

  // Update session activity
  const updateSessionActivity = (sessionId: string) => {
    const sessions = getGlobalSessions();
    const updatedSessions = sessions.map((session) =>
      session.sessionId === sessionId
        ? { ...session, lastActivity: Date.now(), isActive: true }
        : session
    );

    setGlobalSessions(updatedSessions);
    setActiveSessions(updatedSessions);

    const currentSession = getCurrentSession();
    if (currentSession?.sessionId === sessionId) {
      setCurrentSession({ ...currentSession, lastActivity: Date.now() });
    }
  };

  // Sync sessions across tabs/windows
  const syncSessions = () => {
    const sessions = cleanupExpiredSessions();
    const currentSession = getCurrentSession();

    if (currentSession) {
      // Update current session activity
      updateSessionActivity(currentSession.sessionId);

      // Update security state
      setSecurityState((prev) => ({
        ...prev,
        lastActivity: Date.now(),
      }));
    }
  };

  // Check if account is locked
  const isAccountLocked = () => {
    return (
      securityState.lockoutUntil && Date.now() < securityState.lockoutUntil
    );
  };

  // Check rate limiting
  const isRateLimited = () => {
    const now = Date.now();
    const recentAttempts = loginAttempts.filter(
      (attempt) => now - attempt.timestamp < SECURITY_CONFIG.rateLimitWindow
    );
    return recentAttempts.length >= SECURITY_CONFIG.maxAttemptsPerWindow;
  };

  // Log login attempt
  const logLoginAttempt = async (
    success: boolean,
    sessionId?: string,
    locationData?: { ip: string; country: string }
  ) => {
    try {
      const attempt: LoginAttempt = {
        timestamp: Date.now(),
        success,
        ip: locationData?.ip || "Unknown",
        country: locationData?.country || "Unknown",
        sessionId,
      };

      setLoginAttempts((prev) => [...prev.slice(-19), attempt]);
    } catch (error) {
      console.error("Failed to log attempt:", error);
    }
  };

  // Handle failed login
  const handleFailedLogin = async () => {
    const newFailedAttempts = securityState.failedAttempts + 1;

    if (newFailedAttempts >= SECURITY_CONFIG.maxFailedAttempts) {
      setSecurityState((prev) => ({
        ...prev,
        failedAttempts: newFailedAttempts,
        lockoutUntil: Date.now() + SECURITY_CONFIG.lockoutDuration,
      }));
      setError(
        `Account locked for ${
          SECURITY_CONFIG.lockoutDuration / 60000
        } minutes due to multiple failed attempts`
      );
    } else {
      setSecurityState((prev) => ({
        ...prev,
        failedAttempts: newFailedAttempts,
      }));
      setError(
        `Invalid credentials. ${
          SECURITY_CONFIG.maxFailedAttempts - newFailedAttempts
        } attempts remaining.`
      );
    }

    await logLoginAttempt(false);
  };

  // Validate credentials
  const validateCredentials = async (): Promise<{
    user: User | null;
    hasAdminAccess: boolean;
  }> => {
    try {
      console.log("Validating credentials for:", formData.username);

      // Query the users table for matching email and password
      const { data: users, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", formData.username.toLowerCase())
        .eq("password", formData.password)
        .limit(1);

      if (error) {
        console.error("Database query error:", error);
        return { user: null, hasAdminAccess: false };
      }

      if (!users || users.length === 0) {
        console.log("No matching user found");
        return { user: null, hasAdminAccess: false };
      }

      const user = users[0] as User;
      console.log("User found:", user.email, "Admin Status:", user.is_admin);

      // Check if user has admin access
      const hasAdminAccess = user.is_admin === true;

      return { user, hasAdminAccess };
    } catch (error) {
      console.error("Validation error:", error);
      return { user: null, hasAdminAccess: false };
    }
  };

  // Handle login - NOW WITH REAL LOCATION DATA
  const handleLogin = async () => {
    if (isAccountLocked()) {
      setError("Account is locked. Please try again later.");
      return;
    }

    if (isRateLimited()) {
      setError("Too many attempts. Please wait before trying again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Validate credentials against database
      const { user, hasAdminAccess } = await validateCredentials();

      if (!user) {
        await handleFailedLogin();
        setLoading(false);
        return;
      }

      // Check admin access even with valid credentials
      if (!hasAdminAccess) {
        setError("Access denied. Admin privileges required.");
        await logLoginAttempt(false);
        setLoading(false);
        return;
      }

      // Generate session info
      const sessionId = generateSessionId();
      const userId = generateUserId();
      const now = Date.now();

      console.log("Login: Credentials valid, fetching location...");

      // Fetch real location data during login
      const locationData = await fetchLocationData();

      console.log("Login: Location data received:", locationData);

      // Store user info in session
      const userInfo = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        kyc_status: user.kyc_status,
      };

      // Set security state
      setSecurityState((prev) => ({
        ...prev,
        sessionId,
        lastActivity: now,
        sessionStartTime: now,
        failedAttempts: 0,
        lockoutUntil: null,
      }));

      // Create session data with REAL location info
      const sessionData: AdminSession = {
        sessionId,
        ip: locationData.ip,
        country: locationData.country,
        city: locationData.city,
        loginTime: now,
        lastActivity: now,
        isActive: true,
        userId: user.id,
      };

      console.log("Login: Creating session with real data:", sessionData);

      // Add to global sessions
      addOrUpdateSession(sessionData);

      // Start session timer with the actual login time
      startSessionTimer(now);
      console.log("Session timer started for:", sessionId);

      // Start session sync
      startSessionSync();

      // Log successful login with real location
      await logLoginAttempt(true, sessionId, locationData);

      // Set authenticated
      setIsAuthenticated(true);

      console.log("Authentication successful! Session:", sessionId);
    } catch (error) {
      console.error("Login error:", error);
      setError("Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Start session timer - FIXED VERSION
  const startSessionTimer = (startTime: number) => {
    // Clear existing timer first
    if (sessionTimeoutRef.current) {
      clearInterval(sessionTimeoutRef.current);
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const remaining = Math.max(0, SECURITY_CONFIG.sessionTimeout - elapsed);

      setSessionTimeLeft(remaining);

      // Update session activity
      if (securityState.sessionId) {
        updateSessionActivity(securityState.sessionId);
      }

      // Check if session expired
      if (remaining <= 0) {
        console.log("Session expired!");
        handleSessionExpiry();
        return;
      }
    };

    // Start the timer
    sessionTimeoutRef.current = setInterval(updateTimer, 1000);

    // Run immediately to set initial value
    updateTimer();

    console.log(
      "Session timer started, timeout in:",
      SECURITY_CONFIG.sessionTimeout / 1000,
      "seconds"
    );
  };

  // Start session sync
  const startSessionSync = () => {
    if (sessionSyncRef.current) {
      clearInterval(sessionSyncRef.current);
    }

    sessionSyncRef.current = setInterval(syncSessions, 5000); // Sync every 5 seconds
  };

  // Handle session expiry
  const handleSessionExpiry = () => {
    const currentSession = getCurrentSession();
    if (currentSession) {
      removeSession(currentSession.sessionId);
    }
    setIsAuthenticated(false);
    setError("Session expired for security reasons");
    clearSecurityData();
  };

  // Handle logout
  const handleLogout = () => {
    const currentSession = getCurrentSession();
    if (currentSession) {
      removeSession(currentSession.sessionId);
    }
    setIsAuthenticated(false);
    clearSecurityData();
  };

  // Clear all security data
  const clearSecurityData = () => {
    setFormData({ username: "", password: "" });
    setSecurityState({
      failedAttempts: 0,
      lockoutUntil: null,
      lastActivity: Date.now(),
      sessionId: "",
      sessionStartTime: 0,
    });
    setSessionTimeLeft(0);

    if (sessionTimeoutRef.current) {
      clearInterval(sessionTimeoutRef.current);
    }
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    if (sessionSyncRef.current) {
      clearInterval(sessionSyncRef.current);
    }
  };

  // Handle user activity
  const handleActivity = () => {
    if (isAuthenticated && securityState.sessionId) {
      setSecurityState((prev) => ({ ...prev, lastActivity: Date.now() }));
      updateSessionActivity(securityState.sessionId);

      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }

      activityTimeoutRef.current = setTimeout(() => {
        handleSessionExpiry();
      }, SECURITY_CONFIG.inactivityTimeout);
    }
  };

  // Check for existing session on mount
  useEffect(() => {
    const currentSession = getCurrentSession();
    if (currentSession) {
      const now = Date.now();
      const sessionAge = now - currentSession.loginTime;

      if (sessionAge < SECURITY_CONFIG.sessionTimeout) {
        // Restore session
        setSecurityState({
          failedAttempts: 0,
          lockoutUntil: null,
          lastActivity: now,
          sessionId: currentSession.sessionId,
          sessionStartTime: currentSession.loginTime,
        });

        setIsAuthenticated(true);

        // Start timer with original login time
        startSessionTimer(currentSession.loginTime);
        startSessionSync();

        console.log(
          "Restored existing session:",
          currentSession.sessionId,
          "Age:",
          sessionAge / 1000,
          "seconds"
        );
      } else {
        // Session expired, clean up
        console.log("Session expired on restore, cleaning up");
        removeSession(currentSession.sessionId);
      }
    }

    // Load all sessions
    const allSessions = cleanupExpiredSessions();
    setActiveSessions(allSessions);
  }, []);

  // Setup activity listeners
  useEffect(() => {
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
    ];

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true);
      });

      // Don't clear session on unmount - allow tab switching
    };
  }, [isAuthenticated, securityState.sessionId]);

  // Listen for storage changes (multi-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === GLOBAL_SESSIONS_KEY) {
        const sessions = getGlobalSessions();
        setActiveSessions(sessions);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Format time remaining
  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (isAuthenticated) {
    return (
      <div>
        <div className="bg-[#F26623] text-white p-4 flex justify-between items-center">
          <div className="flex flex-row items-center justify-between text-orange-100">
            <h1 className="text-2xl font-bold pr-14">
              Admin Panel - Digital Chain Bank
            </h1>

            <div className="flex flex-row items-center space-x-6">
              <span>Session ID: {securityState.sessionId.slice(0, 8)}...</span>

              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span>Time left: {formatTimeRemaining(sessionTimeLeft)}</span>
              </div>

              <div className="flex items-center">
                <span className="text-sm">
                  Active Sessions: {activeSessions.length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={handleLogout}
              className="text-white border-white hover:bg-white hover:text-[#F26623] bg-transparent"
            >
              Secure Logout
            </Button>
          </div>
        </div>
        <AdminDashboard
          sessionTimeLeft={sessionTimeLeft}
          sessionId={securityState.sessionId}
          onLogout={handleLogout}
          loginAttempts={loginAttempts}
          activeSessions={activeSessions}
          currentSessionId={securityState.sessionId}
          onUpdateSession={updateSessionActivity}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-[#F26623] rounded-lg flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">Secure Admin Access</CardTitle>
          <p className="text-gray-600">Digital Chain Bank Administration</p>

          {/* Security Status Indicators */}
          <div className="flex justify-center space-x-2 mt-4">
            <Badge variant={isAccountLocked() ? "destructive" : "outline"}>
              <Lock className="w-3 h-3 mr-1" />
              {isAccountLocked() ? "Locked" : "Unlocked"}
            </Badge>
            <Badge
              variant={
                securityState.failedAttempts > 0 ? "destructive" : "outline"
              }
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              {securityState.failedAttempts} Failed
            </Badge>
            <Badge variant="outline">
              <Monitor className="w-3 h-3 mr-1" />
              {activeSessions.length} Active
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="email"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              placeholder="Enter your email address"
              disabled={Boolean(loading || isAccountLocked())}
              autoComplete="off"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Enter your password"
                disabled={Boolean(loading || isAccountLocked())}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setShowPassword(!showPassword)}
                disabled={Boolean(loading || isAccountLocked())}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Button
            onClick={handleLogin}
            className="w-full bg-[#F26623] hover:bg-[#E55A1F]"
            disabled={Boolean(
              loading ||
                isAccountLocked() ||
                !formData.username ||
                !formData.password
            )}
          >
            {loading ? "Authenticating..." : "Login to Admin Panel"}
          </Button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Security Information */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium text-blue-800 mb-2">Authentication:</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• Database-backed user authentication</p>
              <p>• Multi-admin session support with cross-tab sync</p>
              <p>• Account lockout after failed attempts</p>
              <p>• Session timeout and inactivity detection</p>
              <p>• Rate limiting and attempt logging</p>
              <p>• Real IP address tracking and geolocation</p>
              <p>• Session persistence across browser tabs</p>
              <p>• Use any email/password from the users table</p>
            </div>
          </div>

          {/* Active Sessions Display */}
          {activeSessions.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <h4 className="font-medium text-green-800 mb-2">
                Active Admin Sessions: {activeSessions.length}
              </h4>
              <div className="space-y-1">
                {activeSessions.slice(-3).map((session, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span>
                        {new Date(session.loginTime).toLocaleTimeString()}
                      </span>
                      <span className="text-gray-500">{session.ip}</span>
                      <span className="text-gray-500">{session.country}</span>
                    </div>
                    <Badge variant="default" className="text-xs">
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Login Attempts */}
          {loginAttempts.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
              <h4 className="font-medium text-gray-800 mb-2">
                Recent Attempts:
              </h4>
              <div className="space-y-1">
                {loginAttempts.slice(-3).map((attempt, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span>
                        {new Date(attempt.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-gray-500">{attempt.ip}</span>
                      <span className="text-gray-500">{attempt.country}</span>
                    </div>
                    <Badge
                      variant={attempt.success ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {attempt.success ? "Success" : "Failed"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
