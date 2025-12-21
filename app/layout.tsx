import type React from "react";
import type { Metadata } from "next";
import PresenceTracker from "@/components/client-presence-tracker";
import LayoutDebugger from "@/components/dev/layout-debugger";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lithuanian Crypto Central Bank",
  description: "Lithuanian Crypto Central Bank",
  generator: "Lithuanian Crypto Central Bank",

  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" }
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico"
  },

  manifest: "/site.webmanifest",
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
        <LayoutDebugger />
        {children}
      </body>
    </html>
  );
}
