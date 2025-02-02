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
      {/* Toggle sidebar button positioned between sidebar and main content */}
      <div className="relative z-10 -ml-3 pl-3">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="absolute top-6 left-6 flex h-8 w-8 items-center justify-center
                     bg-background-main text-accent-foreground hover:text-zinc-400"
        >
          {isOpen ? (
            <ChevronLeft className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </button>
      </div>
      <main className="flex-1 rounded-xl border border-zinc-200 bg-main-background mt-2 ml-0 mr-2 mb-1">
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
