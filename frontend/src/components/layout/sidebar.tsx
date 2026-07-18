"use client";

import { useToggle } from "@/hooks/useToggle";

export function Sidebar() {
  const { isSidebarOpen } = useToggle();

  if (isSidebarOpen)
    return (
      <aside className="bg-accent-ink fixed left-0 z-60 h-full w-80">yo</aside>
    );
}
