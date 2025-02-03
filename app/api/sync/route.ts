import { NextRequest, NextResponse } from "next/server";
import { dbNode } from "@/db/drizzle";
import { chats, chatMessages } from "@/db/schema";
import { eq, gt } from "drizzle-orm";

// Add type definitions for the database rows
type ChatRow = typeof chats.$inferSelect;
type MessageRow = typeof chatMessages.$inferSelect;

// Just an example conflict resolution approach
function isClientNewer(clientUpdated: string | Date | undefined, serverUpdated: Date | null) {
  if (!clientUpdated) return false;
  // Compare timestamps
  const clientDate = (typeof clientUpdated === 'string' ? new Date(clientUpdated) : clientUpdated).getTime();
  const serverDate = serverUpdated?.getTime() ?? 0;
  return clientDate > serverDate;
}

export async function POST(req: NextRequest) {
  try {
    const { lastSync, localChats, localMessages } = await req.json();

    // 1. Pull Phase:
    // Return any server changes since `lastSync`
    const serverChanges = {
      chats: [] as ChatRow[],
      messages: [] as MessageRow[]
    };

    if (lastSync) {
      const lastSyncDate = new Date(lastSync);
      // Store results directly in serverChanges object
      serverChanges.chats = await dbNode
        .select()
        .from(chats)
        .where(gt(chats.updatedAt, lastSyncDate));

      serverChanges.messages = await dbNode
        .select()
        .from(chatMessages)
        .where(gt(chatMessages.updatedAt, lastSyncDate));
    } else {
      serverChanges.chats = await dbNode.select().from(chats);
      serverChanges.messages = await dbNode.select().from(chatMessages);
    }

    // 2. Push Phase: Upsert local changes into server
    const now = new Date();

    // For each local chat
    for (const c of localChats || []) {
      if (!c.userId) {
        console.error("Missing required userId for chat:", c);
        continue;
      }

      // Does it exist on the server?
      const existing = c.id ? await dbNode
        .select()
        .from(chats)
        .where(eq(chats.id, c.id))
        .limit(1) : [];

      const serverRow = existing[0];

      // If 'deleted' is true locally, we can handle soft-delete
      if (c.deleted) {
        // Mark as deleted on server (or physically delete if you prefer):
        if (serverRow) {
          // Soft delete approach
          await dbNode
            .update(chats)
            .set({ deleted: true, updatedAt: now, syncedAt: now })
            .where(eq(chats.id, c.id));
        }
        continue;
      }

      // If no serverRow, we do an insert
      if (!serverRow) {
        // Insert new chat
        await dbNode.insert(chats).values({
          userId: c.userId,
          name: c.name || null,
          projectId: c.projectId || null,
          projectDescriptionId: c.projectDescriptionId || null,
          createdAt: c.createdAt ? new Date(c.createdAt) : now,
          updatedAt: c.updatedAt ? new Date(c.updatedAt) : now,
          syncedAt: now,
          deleted: false,
        });
      } else if (isClientNewer(c.updatedAt, serverRow.updatedAt)) {
        // Update existing chat if client is newer
        await dbNode
          .update(chats)
          .set({
            userId: c.userId,
            name: c.name || null,
            projectId: c.projectId || null,
            projectDescriptionId: c.projectDescriptionId || null,
            updatedAt: c.updatedAt ? new Date(c.updatedAt) : now,
            syncedAt: now,
            deleted: false,
          })
          .where(eq(chats.id, c.id!));
      }
    }

    // For each local chatMessage
    for (const m of localMessages || []) {
      if (!m.chatId || !m.sender || !m.content) {
        console.error("Missing required fields for message:", m);
        continue;
      }

      const existing = m.id ? await dbNode
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.id, m.id))
        .limit(1) : [];

      const serverRow = existing[0];

      if (m.deleted) {
        if (serverRow) {
          await dbNode
            .update(chatMessages)
            .set({ deleted: true, updatedAt: now, syncedAt: now })
            .where(eq(chatMessages.id, m.id));
        }
        continue;
      }

      if (!serverRow) {
        // Insert new message
        await dbNode.insert(chatMessages).values({
          chatId: m.chatId,
          sender: m.sender,
          content: m.content,
          createdAt: m.createdAt ? new Date(m.createdAt) : now,
          updatedAt: m.updatedAt ? new Date(m.updatedAt) : now,
          syncedAt: now,
          deleted: false,
        });
      } else if (isClientNewer(m.updatedAt, serverRow.updatedAt)) {
        // Update existing message if client is newer
        await dbNode
          .update(chatMessages)
          .set({
            chatId: m.chatId,
            sender: m.sender,
            content: m.content,
            updatedAt: m.updatedAt ? new Date(m.updatedAt) : now,
            syncedAt: now,
            deleted: false,
          })
          .where(eq(chatMessages.id, m.id!));
      }
    }

    // 3. Return updated server changes using serverChanges object
    const finalChatsChanged = await dbNode
      .select()
      .from(chats)
      .where(gt(chats.updatedAt, new Date(lastSync || 0)));
    
    const finalMessagesChanged = await dbNode
      .select()
      .from(chatMessages)
      .where(gt(chatMessages.updatedAt, new Date(lastSync || 0)));

    return NextResponse.json({
      serverChatsChanged: finalChatsChanged,
      serverMessagesChanged: finalMessagesChanged,
    });
  } catch (error: unknown) {
    console.error("❌ Sync error:", error);
    // Type guard to check if error is Error object
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json({ 
      error: String(error),
      stack: errorStack,
      details: errorMessage
    }, { status: 500 });
  }
}
