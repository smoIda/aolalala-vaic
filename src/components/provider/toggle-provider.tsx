"use client";

import { createContext, useMemo, useState } from "react";

export type ToggleContextProps = {
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isChatbotOpen: boolean;
  setIsChatbotOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export const ToggleContext = createContext<ToggleContextProps | undefined>(
  undefined,
);

export function ToggleProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  const values = useMemo(
    () => ({
      isSidebarOpen,
      setIsSidebarOpen,
      isChatbotOpen,
      setIsChatbotOpen,
    }),
    [isSidebarOpen, isChatbotOpen],
  );

  return (
    <ToggleContext.Provider value={values}>{children}</ToggleContext.Provider>
  );
}
