"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/app/stores/useThemeStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const aurora = useThemeStore((s) => s.aurora);

  useEffect(() => {
    document.documentElement.setAttribute("data-aurora", aurora);
  }, [aurora]);

  return <>{children}</>;
}
