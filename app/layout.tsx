import "./globals.css";
import { Inter } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import Header from "./components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Local-First Chatbot Platform",
  description: "A local-first chatbot that persists chats and projects",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex flex-col h-screen overflow-hidden`}>
        <SessionProvider>
          <Header />
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
          {/* Register the service worker */}
          <ServiceWorkerRegistration />
        </SessionProvider>
      </body>
    </html>
  );
}
