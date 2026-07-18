"use client";

import { useToggle } from "@/hooks/useToggle";
import { useEffect, useState } from "react";

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { isDarkTheme } = useToggle();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkTheme);
  }, [isDarkTheme]);

  useEffect(() => {
    setMounted(true);
  });

  if (!mounted) return null;

  return <main className="min-h-dvh w-full overflow-hidden">{children}</main>;
}
