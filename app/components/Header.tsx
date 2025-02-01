'use client';

import { signIn, signOut, useSession } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="w-full flex items-center justify-between px-4 py-2 bg-gray-100">
      <div className="font-bold">Local-First Chatbot</div>
      <div>
        {session ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">Signed in as {session.user?.email}</span>
            <button
              className="px-3 py-1 border rounded"
              onClick={() => signOut()}
            >
              Sign out
            </button>
          </div>
        ) : (
          <button className="px-3 py-1 border rounded" onClick={() => signIn()}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
} 