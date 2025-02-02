"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import { SidebarProvider, useSidebar } from "@/hooks/useSidebar";
import Sidebar from "@/components/Sidebar";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { ChevronLeft, ChevronRight } from "lucide-react";

function Shell({ children }: { children: React.ReactNode }) {
  const { isOpen, setIsOpen } = useSidebar();

  return (
    <div className="flex h-full w-full overflow-hidden bg-secondary">
      {isOpen && <Sidebar />}
      <main className="flex-1 rounded-xl border border-zinc-200 bg-main-background mt-2 ml-0 mr-2 mb-1">
        {/* Toggle sidebar: Just an icon, no text */}
        <div className="p-2">
          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center justify-center p-2
                       text-accent-foreground 
                       hover:opacity-90 rounded-md"
          >
            {isOpen ? (
              <ChevronLeft className="w-4 h-4 bg-background-main text-accent-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 bg-background-main text-accent-foreground" />
            )}
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
