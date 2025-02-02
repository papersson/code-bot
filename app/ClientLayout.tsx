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
    // Removed `overflow-hidden` so horizontal scroll is not blocked globally.
    <div className="flex h-full w-full bg-secondary">
      <Sidebar />

      <div
        className={`
          relative z-10 -ml-3 pl-3
          transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-[272px]"}
        `}
      >
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className={`
            absolute top-6 left-6 flex h-8 w-8 items-center justify-center
            bg-background-main text-accent-foreground hover:text-zinc-400
            transition-all duration-200 ease-in-out
            ${isOpen ? "translate-x-0" : "translate-x-[4px]"}
          `}
        >
          {isOpen ? (
            <ChevronLeft className="h-5 w-5 transition-transform duration-200" />
          ) : (
            <ChevronRight className="h-5 w-5 transition-transform duration-200" />
          )}
        </button>
      </div>

      {/* 
        IMPORTANT: Add `min-w-0` so this flex child can shrink if content is wide.
        That allows a wide code block to scroll horizontally instead of pushing outward.
      */}
      <main
        className={`
          flex-1 min-w-0 rounded-xl border border-zinc-200 bg-main-background 
          mt-2 mb-1 mr-2 
          transition-all duration-200 ease-in-out
          ${isOpen ? "ml-0" : "-ml-[272px]"}
        `}
      >
        {/* 
          We allow vertical scrolling here, but we do NOT hide horizontal overflow 
          so code can scroll horizontally if needed. 
        */}
        <div className="h-full overflow-y-auto rounded-xl min-w-0">
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
