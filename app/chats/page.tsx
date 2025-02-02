// app/chats/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/db/dexie";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/ui/skeleton";

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

  return (
    <div className="flex flex-col gap-4 p-6 h-full">
      <div className="space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-3 mt-6">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="mt-auto p-4">
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
