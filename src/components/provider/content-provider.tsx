"use client";

import { useEffect, useState } from "react";

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  });

  if (!mounted) return null;

  return <main className="min-h-dvh w-full overflow-hidden">{children}</main>;
}
