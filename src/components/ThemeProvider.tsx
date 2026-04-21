"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/store/use-app-store";

/**
 * Reads themeMode from the settings store and applies/removes the `dark`
 * class on <html>.  Must be rendered inside the client boundary.
 */
export function ThemeProvider() {
  const themeMode = useSettingsStore(s => s.themeMode);

  useEffect(() => {
    const apply = (dark: boolean) => {
      document.documentElement.classList.toggle("dark", dark);
    };

    if (themeMode === "dark") {
      apply(true);
      return;
    }
    if (themeMode === "light") {
      apply(false);
      return;
    }

    // 'system' — follow OS preference
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeMode]);

  return null;
}
