"use client";

import React, { createContext, useContext, useState } from "react";

interface SidebarContextValue {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentChatId: number | null;
  setCurrentChatId: React.Dispatch<React.SetStateAction<number | null>>;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);

  return (
    <SidebarContext.Provider
      value={{ isOpen, setIsOpen, currentChatId, setCurrentChatId }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
