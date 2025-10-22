import type React from "react";
import type { Metadata } from "next";
import PresenceTracker from "@/components/client-presence-tracker";
import "./globals.css";
import LayoutDebugger from "@/components/dev/layout-debugger"; // Optional client-only logger

export const metadata: Metadata = {
  title: "Digital Chain Bank",
  description: "Digital Chain Bank",
  generator: "Digital Chain Bank",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PresenceTracker />
        <LayoutDebugger /> {/* Optional client-side logger */}
        {children}
      </body>
    </html>
  );
}
