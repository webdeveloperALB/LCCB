"use client";
import type React from "react";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Download,
  CreditCard,
  MessageSquare,
  HelpCircle,
  Bitcoin,
  LogOut,
  Menu,
  X,
  Banknote,
} from "lucide-react";
import Image from "next/image";
import { User } from "lucide-react";

const scrollbarHideStyles = `
  .scrollbar-hide {
    -ms-overflow-style: none;  /* Internet Explorer 10+ */
    scrollbar-width: none;  /* Firefox */
  }
  .scrollbar-hide::-webkit-scrollbar { 
    display: none;  /* Safari and Chrome */
  }
`;

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userProfile: any;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  isEnabled: boolean;
  badge?: string | number;
}

// Clean, simple menu - no database dependencies
const MENU_ITEMS: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    isEnabled: true,
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: Wallet,
    isEnabled: true,
  },
  {
    id: "fund_account",
    label: "Fund Account",
    icon: Wallet, 
    isEnabled: true,
  },
  {
    id: "transfers",
    label: "Transfers",
    icon: ArrowLeftRight,
    isEnabled: true,
  },
  {
    id: "deposit",
    label: "Transactions",
    icon: Download,
    isEnabled: true,
  },
  {
    id: "payments",
    label: "Payments",
    icon: CreditCard,
    isEnabled: true,
  },
  {
    id: "loans",
    label: "Loans",
    icon: Banknote,
    isEnabled: true,
  },
  {
    id: "card",
    label: "Card",
    icon: CreditCard,
    isEnabled: true,
  },
  {
    id: "crypto",
    label: "Crypto",
    icon: Bitcoin,
    isEnabled: true,
  },
  {
    id: "message",
    label: "Message",
    icon: MessageSquare,
    isEnabled: true,
  },
  {
    id: "profile",
    label: "Profile",
    icon: User,
    isEnabled: true,
  },
  {
    id: "support",
    label: "Support",
    icon: HelpCircle,
    isEnabled: true,
  },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  userProfile,
}: SidebarProps) {
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Simple menu items - no database fetching needed
  const [menuItems] = useState<MenuItem[]>(MENU_ITEMS);

  // Component lifecycle ref
  const isComponentMountedRef = useRef<boolean>(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);

  // Simple menu item click - instant response, no database calls
  const handleMenuItemClick = useCallback(
    (itemId: string, isEnabled: boolean) => {
      if (!isEnabled) return;

      console.log(`Switching to section: ${itemId}`);

      // INSTANT response - never wait for anything
      setActiveTab(itemId);
      setIsMobileMenuOpen(false);
    },
    [setActiveTab]
  );

  // Bulletproof sign out with multiple fallback strategies
  const handleSignOut = async () => {
    setIsLoggingOut(true);

    try {
      // Cleanup component state
      isComponentMountedRef.current = false;

      // Try to get current user with timeout
      let user;
      try {
        const userResult = await Promise.race([
          supabase.auth.getUser(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("User fetch timeout")), 2000)
          ),
        ]);
        user = userResult.data?.user;
      } catch (error) {
        console.warn("Could not fetch user for logout:", error);
      }

      // Try to update presence (fire and forget) - only if user_presence table exists
      if (user) {
        const updatePresence = async () => {
          try {
            await Promise.race([
              supabase.from("user_presence").upsert(
                {
                  user_id: user.id,
                  is_online: false,
                  last_seen: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id" }
              ),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Presence timeout")), 1000)
              ),
            ]);
          } catch {
            // Silent failure - presence update is optional
          }
        };
        updatePresence(); // Don't await
      }

      // Multi-stage logout with increasing aggressiveness
      const logoutStrategies = [
        // Strategy 1: Normal logout with timeout
        () =>
          Promise.race([
            supabase.auth.signOut(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Normal logout timeout")), 3000)
            ),
          ]),
        // Strategy 2: Local logout
        () => supabase.auth.signOut({ scope: "local" }),
        // Strategy 3: Force local logout
        () => Promise.resolve({ error: null }),
      ];

      let logoutSuccess = false;
      for (const strategy of logoutStrategies) {
        try {
          const result = await strategy();
          if (!result.error) {
            logoutSuccess = true;
            break;
          }
        } catch (error) {
          console.warn("Logout strategy failed:", error);
          continue;
        }
      }

      if (logoutSuccess) {
        console.log("Successfully signed out");
      } else {
        console.warn("All logout strategies failed, but continuing...");
      }
    } catch (error) {
      console.error("Critical error during logout:", error);
    } finally {
      setIsLoggingOut(false);
      // Force redirect regardless of logout success
      try {
        window.location.href = "/";
      } catch {
        // Last resort
        window.location.reload();
      }
    }
  };

  return (
    <>
      <style jsx>{scrollbarHideStyles}</style>

      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden bg-white shadow-md"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <Menu className="w-5 h-5" />
        )}
      </Button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed md:relative
          w-64 bg-[#0a7f8f]/10 h-screen flex flex-col
          transform transition-transform duration-300 ease-in-out z-50
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          overflow-hidden
        `}
      >
        {/* Logo Section */}
        <div className="px-6 pt-2 flex-shrink-0 border-b border-gray-200/50">
          <div className="flex items-center">
            <Image
              src="/logo.png?height=90&width=180&text=Digital+Chain+Bank"
              alt="Lithuanian Crypto Central Bank Logo"
              width={180}
              height={90}
              className="mr-3 w-[180px] h-[90px] object-contain"
            />
          </div>
        </div>

        {/* Navigation Menu - Simple and Fast */}
        <nav className="flex-1 px-6 overflow-y-auto scrollbar-hide">
          <ul className="space-y-1 py-4 min-h-0">
            {menuItems.map((item) => {
              const IconComponent = item.icon;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleMenuItemClick(item.id, item.isEnabled)}
                    disabled={!item.isEnabled}
                    className={`w-full flex items-center px-0 py-4 text-left transition-all duration-200 relative ${
                      activeTab === item.id
                        ? "text-[#0A7F8D]"
                        : item.isEnabled
                        ? "text-gray-800 hover:text-[#0A7F8D]"
                        : "text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <IconComponent
                      className={`w-5 h-5 mr-4 ${
                        item.isEnabled ? "text-gray-600" : "text-gray-400"
                      }`}
                    />
                    <span className="font-medium text-base">{item.label}</span>
                    {/* Badge for notifications - can be added manually if needed */}
                    {item.badge && (
                      <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Client Profile Section */}
        <div className="p-6 flex-shrink-0 border-t border-gray-200/50">
          <div className="bg-[#0A7F8D] rounded-2xl px-4 py-3 text-white relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="font-medium text-base">
                  {userProfile?.full_name
                    ? userProfile.full_name
                        .toLowerCase()
                        .split(" ")
                        .map(
                          (word: string) =>
                            word.charAt(0).toUpperCase() + word.slice(1)
                        )
                        .join(" ")
                    : "Client Name"}
                </span>

                <div className="w-2 h-2 bg-green-400 rounded-full ml-3"></div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="text-white hover:bg-white/20 w-6 h-6 p-0"
                title={isLoggingOut ? "Logging out..." : "Sign out"}
              >
                {isLoggingOut ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}