import type React from "react";
import type { Metadata } from "next";
import PresenceTracker from "@/components/client-presence-tracker";
import "./globals.css";
import LayoutDebugger from "@/components/dev/layout-debugger"; 

export const metadata: Metadata = {
  title: "Lithuanian Crypto Central Bank",
  description: "Lithuanian Crypto Central Bank",
  generator: "Lithuanian Crypto Central Bank",
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
