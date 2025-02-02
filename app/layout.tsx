import "./globals.css";
import { Inter, JetBrains_Mono } from "next/font/google";
import ClientLayout from "./ClientLayout";
import { auth } from "@/auth";
import SignInPage from "./signin/page";

const inter = Inter({ subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata = {
  title: "Local-First Chatbot Platform",
  description: "A local-first chatbot that persists chats and projects",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    return (
      <html lang="en">
        <body
          className={`${inter.className} ${jetbrainsMono.variable} h-screen w-screen flex items-center justify-center`}
        >
          <SignInPage />
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      {/* IMPORTANT: No “overflow-hidden” here, so horizontal scroll can appear if needed. */}
      <body className={`${inter.className} ${jetbrainsMono.variable} h-screen`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
