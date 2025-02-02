import "./globals.css";
import { Inter } from "next/font/google";
import { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Local-First Chatbot Platform",
  description: "A local-first chatbot that persists chats and projects",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} h-screen overflow-hidden`}>
        <SessionProvider>
          <div className="flex h-full w-full overflow-hidden bg-secondary">
            <Sidebar />
            {/* Main Content */}
            <main className="flex-1 rounded-xl border border-zinc-200 bg-main-background mt-2 ml-0 mr-2 mb-1">
              <div className="h-full overflow-y-auto rounded-xl">
                {children}
              </div>
            </main>
          </div>
          <ServiceWorkerRegistration />
        </SessionProvider>
      </body>
    </html>
  );
}
