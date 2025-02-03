import { db } from "@/db/dexie";

export async function syncWithServer() {
  try {
    const lastSync = localStorage.getItem("lastSyncTime") || null;

    // Get records that have never been synced (syncedAt is undefined or null)
    // or where updatedAt is more recent than syncedAt
    const unsyncedChats = await db.chats
      .filter(chat => {
        // Ensure chat.updatedAt and chat.syncedAt are properly compared
        if (!chat.syncedAt) return true; // If never synced, needs sync
        if (!chat.updatedAt) return false; // If no updatedAt, doesn't need sync
        return chat.updatedAt > chat.syncedAt;
      })
      .toArray();

    const unsyncedMessages = await db.chatMessages
      .filter(msg => {
        // Ensure msg.updatedAt and msg.syncedAt are properly compared
        if (!msg.syncedAt) return true; // If never synced, needs sync
        if (!msg.updatedAt) return false; // If no updatedAt, doesn't need sync
        return msg.updatedAt > msg.syncedAt;
      })
      .toArray();

    console.log('Syncing with server:', {
      lastSync,
      unsyncedChatsCount: unsyncedChats.length,
      unsyncedMessagesCount: unsyncedMessages.length,
      firstChat: unsyncedChats[0],
      firstMessage: unsyncedMessages[0]
    });

    // POST them to /api/sync
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastSync,        // the last time we synced
        localChats: unsyncedChats,
        localMessages: unsyncedMessages,
        // could also send localProjects, localProjectDescriptions, etc.
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Sync failed with status ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    const now = new Date();

    // 1) Update local Dexie with server changes:
    // e.g., serverChatsChanged, serverMessagesChanged
    const { serverChatsChanged, serverMessagesChanged } = data;

    for (const sc of serverChatsChanged || []) {
      await db.chats.put({
        ...sc,
        updatedAt: new Date(sc.updatedAt),
        syncedAt: new Date(sc.syncedAt ?? sc.updatedAt), // or now
      });
    }

    for (const sm of serverMessagesChanged || []) {
      await db.chatMessages.put({
        ...sm,
        updatedAt: new Date(sm.updatedAt),
        syncedAt: new Date(sm.syncedAt ?? sm.updatedAt),
      });
    }

    // 2) Mark our local changes as synced
    for (const c of unsyncedChats) {
      await db.chats.update(c.id!, { syncedAt: now });
    }
    for (const m of unsyncedMessages) {
      await db.chatMessages.update(m.id!, { syncedAt: now });
    }

    // 3) Update local lastSyncTime
    localStorage.setItem("lastSyncTime", now.toISOString());
    
    console.log("✅ Sync complete.");
  } catch (err) {
    console.error("❌ Sync error", err);
  }
}
