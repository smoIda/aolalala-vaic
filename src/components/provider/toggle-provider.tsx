"use client";

import { createContext, useMemo, useState } from "react";

export type ToggleContextProps = {
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isChatbotOpen: boolean;
  setIsChatbotOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDarkTheme: boolean;
  setIsDarkTheme: React.Dispatch<React.SetStateAction<boolean>>;
};

export const ToggleContext = createContext<ToggleContextProps | undefined>(
  undefined,
);

export function ToggleProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  const values = useMemo(
    () => ({
      isSidebarOpen,
      setIsSidebarOpen,
      isChatbotOpen,
      setIsChatbotOpen,
      isDarkTheme,
      setIsDarkTheme,
    }),
    [isSidebarOpen, isChatbotOpen, isDarkTheme],
  );

  return (
    <ToggleContext.Provider value={values}>{children}</ToggleContext.Provider>
  );
}
