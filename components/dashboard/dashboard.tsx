"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "./sidebar";
import DashboardContent from "./dashboard-content";
import AccountsSection from "./accounts-section";
import DepositsSection from "./transaction-history";
import PaymentsSection from "./payments-section";
import CardSection from "./card-section";
import SupportSection from "./support-section";
import TransfersSection from "./transfers-section-fixed";
import CryptoSection from "./crypto-section-fixed";
import MessageSection from "./message-section-database";
import LoansSection from "./loans-section";
import Profile from "./Profile";
import { useRouter } from "next/navigation";
if (process.env.NODE_ENV === "production") {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

interface UserProfile {
  id: string;
  client_id: string;
  full_name: string;
  email: string;
  created_at?: string;
  updated_at?: string;
}

interface DatabaseState {
  isHealthy: boolean;
  lastHealthCheck: number;
  consecutiveFailures: number;
  isReconnecting: boolean;
}

interface BaseSectionProps {
  userProfile: UserProfile;
}

interface ExtendedSectionProps extends BaseSectionProps {
  setActiveTab?: (tab: string) => void;
}

class DatabaseManager {
  private static instance: DatabaseManager;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectionTimeout: NodeJS.Timeout | null = null;
  private state: DatabaseState = {
    isHealthy: true,
    lastHealthCheck: Date.now(),
    consecutiveFailures: 0,
    isReconnecting: false,
  };
  private listeners: ((state: DatabaseState) => void)[] = [];
  private activeOperations: Map<string, Promise<any>> = new Map();
  private operationTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private isDestroyed = false;

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private constructor() {
    this.startHealthMonitoring();
    this.setupConnectionRecovery();
  }

  subscribe(callback: (state: DatabaseState) => void): () => void {
    if (this.isDestroyed) return () => {};

    this.listeners.push(callback);
    try {
      callback(this.state);
    } catch (error) {
      console.error("Error in initial database state callback:", error);
    }

    return () => {
      this.listeners = this.listeners.filter(
        (listener) => listener !== callback
      );
    };
  }

  private notifyListeners(): void {
    if (this.isDestroyed) return;

    requestAnimationFrame(() => {
      this.listeners.forEach((listener) => {
        try {
          listener(this.state);
        } catch (error) {
          console.error("Error in database state listener:", error);
        }
      });
    });
  }

  private startHealthMonitoring(): void {
    if (this.isDestroyed) return;

    const getCheckInterval = () => (this.state.isHealthy ? 15000 : 2000);

    const scheduleNextCheck = () => {
      if (this.isDestroyed) return;

      if (this.healthCheckInterval) {
        clearTimeout(this.healthCheckInterval);
      }
      this.healthCheckInterval = setTimeout(() => {
        if (!this.isDestroyed) {
          this.performHealthCheck().finally(() => {
            if (!this.isDestroyed) {
              scheduleNextCheck();
            }
          });
        }
      }, getCheckInterval());
    };

    scheduleNextCheck();
    this.performHealthCheck();
  }

  private setupConnectionRecovery(): void {
    if (this.isDestroyed) return;

    const handleOnline = () => {
      if (this.isDestroyed) return;
      console.log("Browser back online, checking database connection");
      this.performHealthCheck();
    };

    const handleOffline = () => {
      if (this.isDestroyed) return;
      console.log("Browser offline detected");
      this.state = {
        ...this.state,
        isHealthy: false,
        consecutiveFailures: this.state.consecutiveFailures + 1,
      };
      this.notifyListeners();
    };

    const handleVisibilityChange = () => {
      if (this.isDestroyed) return;
      if (!document.hidden && this.state.consecutiveFailures > 0) {
        console.log("Page visible again, checking database connection");
        setTimeout(() => {
          if (!this.isDestroyed) {
            this.performHealthCheck();
          }
        }, 500);
      }
    };

    window.addEventListener("online", handleOnline, { passive: true });
    window.addEventListener("offline", handleOffline, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange, {
      passive: true,
    });
  }

  private async performHealthCheck(): Promise<void> {
    if (this.isDestroyed) return;

    try {
      const startTime = Date.now();
      const operationKey = `health-check-${startTime}`;

      const controller = new AbortController();
      this.abortControllers.set(operationKey, controller);

      const timeoutId = setTimeout(() => {
        if (!this.isDestroyed) {
          controller.abort();
        }
      }, 5000);

      const { error } = await supabase
        .from("profiles")
        .select("id")
        .limit(1)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);
      this.abortControllers.delete(operationKey);

      const responseTime = Date.now() - startTime;

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (responseTime > 5000) {
        throw new Error("Database response timeout");
      }

      // Health check passed
      const wasUnhealthy = !this.state.isHealthy;
      this.state = {
        isHealthy: true,
        lastHealthCheck: Date.now(),
        consecutiveFailures: 0,
        isReconnecting: false,
      };

      if (wasUnhealthy) {
        console.log("Database connection restored");
      }

      this.notifyListeners();
    } catch (error) {
      if (this.isDestroyed) return;

      console.error("Database health check failed:", error);

      this.state = {
        ...this.state,
        isHealthy: false,
        consecutiveFailures: this.state.consecutiveFailures + 1,
        lastHealthCheck: Date.now(),
        isReconnecting: false,
      };

      this.notifyListeners();

      if (this.state.consecutiveFailures <= 10) {
        this.scheduleReconnection();
      }
    }
  }

  private scheduleReconnection(): void {
    if (this.isDestroyed || this.state.isReconnecting) return;

    this.state = { ...this.state, isReconnecting: true };
    this.notifyListeners();

    const baseDelay = Math.min(
      500 * Math.pow(1.5, this.state.consecutiveFailures),
      10000
    );
    const jitter = Math.random() * 500;
    const delay = baseDelay + jitter;

    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
    }

    this.reconnectionTimeout = setTimeout(() => {
      if (!this.isDestroyed) {
        this.performHealthCheck();
      }
    }, delay);
  }

  async executeOperation<T>(
    operationKey: string,
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      timeoutMs?: number;
      skipHealthCheck?: boolean;
    } = {}
  ): Promise<T> {
    if (this.isDestroyed) {
      throw new Error("DatabaseManager is destroyed");
    }

    const {
      maxRetries = 3, // Increased retries for better reliability
      timeoutMs = 8000, // Reduced timeout for faster response
      skipHealthCheck = false,
    } = options;

    this.cancelOperation(operationKey);

    if (!skipHealthCheck && !this.state.isHealthy) {
      try {
        await this.waitForHealthyConnection(1000); // Reduced wait time
      } catch (error) {
        console.warn(
          "Proceeding with unhealthy connection for faster response"
        );
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (this.isDestroyed) {
        throw new Error("Operation cancelled - DatabaseManager destroyed");
      }

      try {
        const operationPromise = this.wrapWithTimeout(
          operation(),
          timeoutMs,
          operationKey
        );

        this.activeOperations.set(operationKey, operationPromise);

        const result = await operationPromise;

        this.activeOperations.delete(operationKey);
        this.clearOperationTimeout(operationKey);

        return result;
      } catch (error: any) {
        lastError = error;

        this.activeOperations.delete(operationKey);
        this.clearOperationTimeout(operationKey);

        console.error(
          `Operation failed (attempt ${attempt + 1}/${maxRetries + 1}):`,
          {
            operationKey,
            error: error.message,
            isTimeout: error.name === "TimeoutError",
          }
        );

        if (this.isConnectionError(error) && this.state.isHealthy) {
          this.state = {
            ...this.state,
            isHealthy: false,
            consecutiveFailures: this.state.consecutiveFailures + 1,
          };
          this.notifyListeners();
          this.scheduleReconnection();
        }

        if (attempt < maxRetries) {
          const delay = Math.min(200 * Math.pow(1.5, attempt), 1000);
          await this.sleep(delay);
        }
      }
    }

    throw (
      lastError ||
      new Error(`Operation ${operationKey} failed after all retries`)
    );
  }

  private wrapWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationKey: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.isDestroyed) {
        reject(new Error("Operation cancelled - DatabaseManager destroyed"));
        return;
      }

      const timeoutId = setTimeout(() => {
        if (!this.isDestroyed) {
          const error = new Error(`Operation timeout after ${timeoutMs}ms`);
          error.name = "TimeoutError";
          reject(error);
        }
      }, timeoutMs);

      this.operationTimeouts.set(operationKey, timeoutId);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => {
          clearTimeout(timeoutId);
          this.operationTimeouts.delete(operationKey);
        });
    });
  }

  private cancelOperation(operationKey: string): void {
    this.activeOperations.delete(operationKey);
    this.clearOperationTimeout(operationKey);

    const controller = this.abortControllers.get(operationKey);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(operationKey);
    }
  }

  private clearOperationTimeout(operationKey: string): void {
    const timeoutId = this.operationTimeouts.get(operationKey);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.operationTimeouts.delete(operationKey);
    }
  }

  private isConnectionError(error: any): boolean {
    const connectionErrors = [
      "fetch",
      "network",
      "timeout",
      "connection",
      "ECONNREFUSED",
      "ENOTFOUND",
      "ETIMEDOUT",
      "abort",
    ];

    const errorMessage = (error.message || "").toLowerCase();
    return connectionErrors.some((keyword) => errorMessage.includes(keyword));
  }

  private async waitForHealthyConnection(timeoutMs: number): Promise<void> {
    if (this.state.isHealthy || this.isDestroyed) return;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for healthy database connection"));
      }, timeoutMs);

      const unsubscribe = this.subscribe((state) => {
        if (state.isHealthy || this.isDestroyed) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getState(): DatabaseState {
    return { ...this.state };
  }

  destroy(): void {
    this.isDestroyed = true;

    if (this.healthCheckInterval) {
      clearTimeout(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
      this.reconnectionTimeout = null;
    }

    this.activeOperations.clear();
    this.operationTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.operationTimeouts.clear();

    this.abortControllers.forEach((controller) => controller.abort());
    this.abortControllers.clear();

    this.listeners = [];
  }
}

class SectionRenderer {
  private sections = {
    dashboard: DashboardContent,
    accounts: AccountsSection,
    transfers: TransfersSection,
    deposit: DepositsSection,
    payments: PaymentsSection,
    card: CardSection,
    crypto: CryptoSection,
    message: MessageSection,
    support: SupportSection,
    profile: Profile,
    loans: LoansSection,
  };

  private memoizedComponents = new Map<string, React.ComponentType<any>>();

  renderSection(
    sectionName: string,
    userProfile: UserProfile,
    additionalProps: any = {}
  ): React.ReactNode {
    if (!userProfile) {
      return this.createErrorComponent("User profile not available");
    }

    const SectionComponent =
      this.sections[sectionName as keyof typeof this.sections];

    if (!SectionComponent) {
      return this.createErrorComponent(`Section "${sectionName}" not found`);
    }

    try {
      const props: ExtendedSectionProps = {
        userProfile,
        ...additionalProps,
      };

      const componentKey = `${sectionName}-${userProfile.id}`;
      if (!this.memoizedComponents.has(componentKey)) {
        this.memoizedComponents.set(
          componentKey,
          memo(SectionComponent as React.ComponentType<any>)
        );
      }

      const MemoizedComponent = this.memoizedComponents.get(componentKey)!;

      return React.createElement(MemoizedComponent, props);
    } catch (error) {
      console.error(`Error creating section ${sectionName}:`, error);
      return this.createErrorComponent(`Failed to load ${sectionName}`);
    }
  }

  private createErrorComponent(message: string): React.ReactNode {
    return React.createElement("div", {
      className: "min-h-screen flex items-center justify-center",
      children: React.createElement("div", {
        className: "text-center",
        children: [
          React.createElement("div", {
            key: "icon",
            className:
              "w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4",
            children: "⚠️",
          }),
          React.createElement("h2", {
            key: "title",
            className: "text-xl font-semibold text-gray-900 mb-2",
            children: "Section Error",
          }),
          React.createElement("p", {
            key: "message",
            className: "text-gray-600",
            children: message,
          }),
        ],
      }),
    });
  }
}

const ConnectionStatusIndicator = memo(
  ({ dbState }: { dbState: DatabaseState }) => {
    if (dbState.isHealthy) return null;

    return (
      <div className="fixed top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-200 text-yellow-800 px-4 py-2 text-sm text-center z-50">
        <div className="flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
          <span>
            {dbState.isReconnecting
              ? "Reconnecting to database..."
              : `Connection issues detected (${dbState.consecutiveFailures} failures)`}
          </span>
        </div>
      </div>
    );
  }
);

ConnectionStatusIndicator.displayName = "ConnectionStatusIndicator";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      "Dashboard Error Boundary caught an error:",
      error,
      errorInfo
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 text-red-500">⚠️</div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-4">
              The dashboard encountered an unexpected error. Please refresh the
              page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#0A7F8D] text-white px-6 py-2 rounded-lg hover:bg-[#0A7F8D]/90 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main Dashboard Component
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbState, setDbState] = useState<DatabaseState>({
    isHealthy: true,
    lastHealthCheck: Date.now(),
    consecutiveFailures: 0,
    isReconnecting: false,
  });

  const router = useRouter();
  const lastActivityRef = useRef(Date.now());
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializationRef = useRef(false);
  const mountedRef = useRef(true);

  const dbManager = useMemo(() => {
    const manager = DatabaseManager.getInstance();
    return manager;
  }, []);

  const sectionRenderer = useMemo(() => new SectionRenderer(), []);

  const generateClientId = useCallback(() => {
    return Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
  }, []);

  const createUserProfile = useCallback(
    async (user: any): Promise<UserProfile> => {
      const profileData = {
        id: user.id,
        client_id: generateClientId(),
        full_name:
          user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        email: user.email,
      };

      const profile = await dbManager.executeOperation(
        `create-profile-${user.id}`,
        async () => {
          const { data, error } = await supabase
            .from("profiles")
            .upsert(profileData, { onConflict: "id" })
            .select()
            .single();

          if (error) throw error;
          return data;
        },
        { maxRetries: 3, timeoutMs: 8000 } // Increased retries, reduced timeout
      );

      const balanceOperations = [
        "crypto_balances",
        "euro_balances",
        "cad_balances",
        "usd_balances",
      ];

      const balancePromises = balanceOperations.map((table) =>
        dbManager
          .executeOperation(
            `create-balance-${table}-${user.id}-${Date.now()}`,
            async () => {
              const { error } = await supabase
                .from(table)
                .upsert(
                  { user_id: user.id, balance: 0 },
                  { onConflict: "user_id" }
                );
              if (error) throw error;
            },
            { maxRetries: 2, timeoutMs: 3000 }
          )
          .catch((error) => {
            console.warn(`Failed to create ${table}:`, error);
            return null;
          })
      );

      Promise.allSettled(balancePromises);

      return profile;
    },
    [dbManager, generateClientId]
  );

  const fetchUserData = useCallback(async (): Promise<void> => {
    if (!dbManager || !mountedRef.current) return;

    try {
      setError(null);
      setLoading(true);

      const userData = await dbManager.executeOperation(
        `fetch-user-auth-${Date.now()}`,
        async () => {
          const {
            data: { user },
            error,
          } = await supabase.auth.getUser();
          if (error) throw error;
          if (!user) throw new Error("No authenticated user found");
          return user;
        },
        { maxRetries: 2, timeoutMs: 5000 }
      );

      if (!mountedRef.current) return;

      const profile = await dbManager.executeOperation(
        `fetch-profile-${userData.id}-${Date.now()}`,
        async () => {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userData.id)
            .single();

          if (error?.code === "PGRST116") {
            return await createUserProfile(userData);
          }
          if (error) throw error;
          return data;
        },
        { maxRetries: 2, timeoutMs: 8000 }
      );

      if (mountedRef.current) {
        setUserProfile(profile);
        console.log("User profile loaded successfully");
      }
    } catch (error: any) {
      console.error("Error fetching user data:", error);
      if (mountedRef.current) {
        setError(error.message || "Failed to load user data");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [dbManager, createUserProfile]);

  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const setupActivityTracking = useCallback(() => {
    const IDLE_TIME = 900000; // 15 minutes
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledActivity = () => {
      if (throttleTimeout || !mountedRef.current) return;
      throttleTimeout = setTimeout(() => {
        if (mountedRef.current) {
          updateActivity();
        }
        throttleTimeout = null;
      }, 15000); // Reduced throttle time for better responsiveness
    };

    events.forEach((event) => {
      document.addEventListener(event, throttledActivity, { passive: true });
    });

    activityTimeoutRef.current = setInterval(() => {
      if (!mountedRef.current) return;

      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity >= IDLE_TIME) {
        console.log("Auto-logout due to inactivity");
        supabase.auth.signOut().finally(() => {
          if (mountedRef.current) {
            router.push("/");
          }
        });
      }
    }, 60000); // Reduced check interval

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledActivity);
      });
      if (activityTimeoutRef.current) {
        clearInterval(activityTimeoutRef.current);
      }
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [updateActivity, router]);

  const handleTabChange = useCallback(
    (newTab: string) => {
      if (!mountedRef.current) return;

      updateActivity();
      setActiveTab(newTab);
      console.log(`Switching to tab: ${newTab}`);
    },
    [updateActivity]
  );

  useEffect(() => {
    if (initializationRef.current || !mountedRef.current) return;
    initializationRef.current = true;

    console.log("Initializing dashboard");

    const initPromises = [fetchUserData(), Promise.resolve(updateActivity())];

    Promise.allSettled(initPromises);

    const cleanup = setupActivityTracking();
    const unsubscribe = dbManager.subscribe(setDbState);

    return () => {
      cleanup();
      unsubscribe();
    };
  }, [fetchUserData, updateActivity, setupActivityTracking, dbManager]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      console.log("Dashboard unmounting");
      mountedRef.current = false;
    };
  }, []);

  const LoadingComponent = useMemo(
    () => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0A7F8D] mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {dbState.isReconnecting
              ? "Connecting to database..."
              : "Loading dashboard..."}
          </p>
        </div>
      </div>
    ),
    [dbState.isReconnecting]
  );

  const ErrorComponent = useMemo(
    () => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 text-red-500">⚠️</div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Connection Error
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchUserData();
            }}
            className="bg-[#0A7F8D] text-white px-6 py-2 rounded-lg hover:bg-[#0A7F8D]/90 transition-colors"
          >
            Retry Connection
          </button>
          <div className="mt-3 text-xs text-gray-500">
            Database Status: {dbState.isHealthy ? "Healthy" : "Issues Detected"}
          </div>
        </div>
      </div>
    ),
    [error, dbState.isHealthy, fetchUserData]
  );

  // Loading state
  if (loading) {
    return LoadingComponent;
  }

  // Error state
  if (error && !userProfile) {
    return ErrorComponent;
  }

  return (
    <ErrorBoundary>
      <div className="relative h-screen bg-gray-100">
        <ConnectionStatusIndicator dbState={dbState} />

        <div className="flex h-full">
          {userProfile && (
            <div className="md:w-64 md:h-full md:fixed md:left-0 md:top-0 md:z-20">
              <Sidebar
                activeTab={activeTab}
                setActiveTab={handleTabChange}
                userProfile={userProfile}
              />
            </div>
          )}

          <div
            className={`flex-1 md:ml-64 overflow-auto ${
              !dbState.isHealthy ? "pt-12" : ""
            }`}
          >
            {userProfile && (
              <React.Suspense
                fallback={
                  <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A7F8D]"></div>
                  </div>
                }
              >
                {sectionRenderer.renderSection(activeTab, userProfile, {
                  setActiveTab: handleTabChange,
                })}
              </React.Suspense>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
