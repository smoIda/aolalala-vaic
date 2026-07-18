"use client";

import { useToggle } from "@/hooks/useToggle";
import { useEffect, useState } from "react";

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { isDarkTheme } = useToggle();

  useEffect(() => {
    setMounted(true);
  });

  if (!mounted) return null;

  return (
    <main
      className={`bg-white-ink min-h-dvh w-full overflow-hidden ${isDarkTheme && "dark"}`}
    >
      {children}
    </main>
  );
}
