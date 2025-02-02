import "./globals.css";
import { Inter } from "next/font/google";
import ClientLayout from "./ClientLayout";
import { auth } from "@/auth";
import SignInPage from "./signin/page";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Local-First Chatbot Platform",
  description: "A local-first chatbot that persists chats and projects",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    // If NOT signed in => render a minimal layout.
    return (
      <html lang="en">
        <body
          className={`${inter.className} h-screen w-screen flex items-center justify-center`}
        >
          {<SignInPage />}
        </body>
      </html>
    );
  }
  
  return (
    <html lang="en">
      <body className={`${inter.className} h-screen overflow-hidden`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
