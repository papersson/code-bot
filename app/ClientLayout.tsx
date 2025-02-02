"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import { SidebarProvider, useSidebar } from "@/hooks/useSidebar";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import Sidebar from "@/components/Sidebar";
import { cn } from "@/lib/utils"; // for optional tailwind merges if needed

function Shell({ children }: { children: React.ReactNode }) {
  // Access the sidebar context
  const { isOpen, setIsOpen } = useSidebar();

  return (
    <div className="flex h-full w-full overflow-hidden bg-secondary">
      {isOpen && <Sidebar />}
      <main className="flex-1 rounded-xl border border-zinc-200 bg-main-background mt-2 ml-0 mr-2 mb-1">
        {/* Example button to toggle sidebar */}
        <div className="p-2">
          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className="px-3 py-2 rounded-md bg-accent text-accent-foreground"
          >
            Toggle Sidebar
          </button>
        </div>

        <div className="h-full overflow-y-auto rounded-xl">
          {children}
        </div>
      </main>
      <ServiceWorkerRegistration />
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SidebarProvider>
        <Shell>{children}</Shell>
      </SidebarProvider>
    </SessionProvider>
  );
}
