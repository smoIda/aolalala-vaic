"use client";

import { useContext } from "react";

import {
  ToggleContext,
  ToggleContextProps,
} from "@/components/provider/toggle-provider";

export const useToggle = (): ToggleContextProps => {
  const context = useContext(ToggleContext);

  if (!context) throw new Error("useToggle must be inside ToggleProvider");

  return context;
};
