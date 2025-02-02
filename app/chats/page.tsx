// app/chats/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/db/dexie";
import { useSession } from "next-auth/react";

export default function ChatsIndexPage() {
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.email) return;

    (async () => {
      // For example, just pick the last chat (or any chat).
      const userEmail = session!.user!.email!;
      const userChats = await db.chats.where("userId").equals(userEmail).toArray();
      if (userChats.length > 0) {
        router.replace(`/chats/${userChats[userChats.length - 1].id}`);
      }
    })();
  }, [router, session]);

  if (!session) {
    return <div className="p-4">Please sign in to view chats.</div>;
  }

  return <div className="p-4">Loading...</div>;
}
