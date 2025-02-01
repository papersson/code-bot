// app/api/sync/route.ts
import { NextResponse } from "next/server";
import { dbRemote } from "@/db/drizzle";
import { chats, chatMessages, projects, projectDescriptions } from "@/db/schema";
import { eq, gte } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // We expect something like:
    // {
    //   chats: Chat[],
    //   chatMessages: ChatMessage[],
    //   projects: Project[],
    //   projectDescriptions: ProjectDescription[],
    // }
    // Each record should have an updatedAt to do last-write-wins.

    // 1) Upsert local changes into remote DB for each table
    if (body.chats) {
      for (const chat of body.chats) {
        // 1a) Check remote for a record with the same id
        if (!chat.id) continue; // skip records with no ID

        const [remote] = await dbRemote.select().from(chats).where(eq(chats.id, chat.id));

        // If remote doesn’t exist, insert
        // If remote exists, compare updatedAt and do last-writer-wins
        if (!remote) {
          await dbRemote.insert(chats).values({
            id: chat.id,
            userId: chat.userId,
            projectId: chat.projectId ?? null,
            projectDescriptionId: chat.projectDescriptionId ?? null,
            createdAt: chat.createdAt ? new Date(chat.createdAt) : null,
            updatedAt: chat.updatedAt ? new Date(chat.updatedAt) : null,
          });
        } else {
          // compare updatedAt
          const localUpdated = new Date(chat.updatedAt ?? 0).getTime();
          const remoteUpdated = remote.updatedAt ? remote.updatedAt.getTime() : 0;
          if (localUpdated > remoteUpdated) {
            // local is newer => update remote
            await dbRemote
              .update(chats)
              .set({
                userId: chat.userId,
                projectId: chat.projectId ?? null,
                projectDescriptionId: chat.projectDescriptionId ?? null,
                updatedAt: chat.updatedAt ? new Date(chat.updatedAt) : null,
              })
              .where(eq(chats.id, chat.id));
          }
        }
      }
    }

    // Repeat similar logic for chatMessages, projects, projectDescriptions
    // For brevity, omitted here. Real code would do the same pattern.

    // 2) Now gather all remote records that have updatedAt newer than the local’s last sync time
    // In practice, the client might send a “lastSyncTime” or we might compare record by record.
    // For simplicity, let’s assume we just return everything for now:

    const remoteChats = await dbRemote.select().from(chats);
    const remoteMessages = await dbRemote.select().from(chatMessages);
    const remoteProjects = await dbRemote.select().from(projects);
    const remoteDescriptions = await dbRemote.select().from(projectDescriptions);

    return NextResponse.json({
      status: "ok",
      message: "Remote sync complete.",
      // these are the "remote truth" that the client can merge
      remoteChats,
      remoteMessages,
      remoteProjects,
      remoteDescriptions,
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json({ status: "error", error: String(error) }, { status: 500 });
  }
}
