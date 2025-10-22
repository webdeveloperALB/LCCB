"use client";

import { useEffect } from "react";

export default function LayoutDebugger() {
  useEffect(() => {
    console.log("⚙️ Root layout (client wrapper) mounted");
    return () => {
      console.log("🧹 Root layout (client wrapper) unmounted");
    };
  }, []);

  return null;
}
