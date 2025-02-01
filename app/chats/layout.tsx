"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { db, Chat, Project } from "@/db/dexie";

// Shadcn components
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

// Lucide icons
import { Plus, Folder } from "lucide-react";

export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const userEmail = session?.user?.email;

  // All unassigned chats (i.e. projectId == null)
  const [recentChats, setRecentChats] = useState<Chat[]>([]);
  // Grouped assigned chats: projectId -> [chats]
  const [projectChats, setProjectChats] = useState<Record<number, Chat[]>>({});
  // Projects
  const [projects, setProjects] = useState<Project[]>([]);

  // Dialog for creating new project
  const [openProjectDialog, setOpenProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // Renaming logic (unchanged from your example, or remove if you prefer)
  const [renamingChatId, setRenamingChatId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Load data
  useEffect(() => {
    if (!userEmail) return;

    (async () => {
      // Grab all chats for this user
      const allChats = await db.chats.where("userId").equals(userEmail).toArray();

      // Separate unassigned from assigned
      const unassigned = allChats.filter((c) => !c.projectId).sort(sortByRecent);
      setRecentChats(unassigned);

      // Group by project
      const grouped: Record<number, Chat[]> = {};
      allChats
        .filter((c) => c.projectId)
        .sort(sortByRecent)
        .forEach((chat) => {
          const pid = chat.projectId as number;
          if (!grouped[pid]) grouped[pid] = [];
          grouped[pid].push(chat);
        });
      setProjectChats(grouped);

      // Load projects
      const allProjects = await db.projects.orderBy("id").toArray();
      setProjects(allProjects);
    })();
  }, [userEmail, renamingChatId]);

  // Helper: sort by updatedAt desc or createdAt desc
  function sortByRecent(a: Chat, b: Chat) {
    const ad = a.updatedAt ?? a.createdAt ?? 0;
    const bd = b.updatedAt ?? b.createdAt ?? 0;
    return new Date(bd).getTime() - new Date(ad).getTime();
  }

  if (!session) {
    return (
      <div className="p-4">
        <p>Please sign in to view chats.</p>
        <div>{children}</div>
      </div>
    );
  }

  // Create a new chat
  async function handleNewChat() {
    const now = new Date();
    const newId = await db.chats.add({
      userId: userEmail!,
      name: "New Chat",
      createdAt: now,
      updatedAt: now,
    });
    router.push(`/chats/${newId}`);
  }

  // Drag/Drop
  function onDragStartChat(e: React.DragEvent<HTMLDivElement>, chat: Chat) {
    // Transfer the chat's ID so we know which chat we're dropping
    e.dataTransfer.setData("text/plain", String(chat.id));
  }
  function onDragOverProject(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }
  async function onDropProject(e: React.DragEvent<HTMLDivElement>, projectId: number) {
    e.preventDefault();
    const chatIdStr = e.dataTransfer.getData("text/plain");
    const chatId = Number(chatIdStr);
    if (!chatId) return;

    // Update that chat's projectId
    const now = new Date();
    await db.chats.update(chatId, { projectId, updatedAt: now });

    // Force re‐load
    const allChats = await db.chats.where("userId").equals(userEmail!).toArray();
    const unassigned = allChats.filter((c) => !c.projectId).sort(sortByRecent);
    setRecentChats(unassigned);

    const grouped: Record<number, Chat[]> = {};
    allChats
      .filter((c) => c.projectId)
      .sort(sortByRecent)
      .forEach((chat) => {
        const pid = chat.projectId as number;
        if (!grouped[pid]) grouped[pid] = [];
        grouped[pid].push(chat);
      });
    setProjectChats(grouped);
  }

  // Project creation
  async function createProject() {
    if (!newProjectName.trim()) return;
    const now = new Date();
    await db.projects.add({
      name: newProjectName,
      createdAt: now,
      updatedAt: now,
    });
    setOpenProjectDialog(false);
    setNewProjectName("");
    // Reload projects:
    const allProjects = await db.projects.orderBy("id").toArray();
    setProjects(allProjects);
  }

  // Begin renaming a chat
  function startRename(chatId: number, currentName: string) {
    setRenamingChatId(chatId);
    setRenameValue(currentName);
  }
  // Commit rename
  async function commitRename(chatId: number) {
    if (!renameValue.trim()) return;
    const now = new Date();
    await db.chats.update(chatId, {
      name: renameValue,
      updatedAt: now,
    });
    setRenamingChatId(null);
    setRenameValue("");
  }
  // Cancel rename
  function cancelRename() {
    setRenamingChatId(null);
    setRenameValue("");
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-secondary">
      {/* Sidebar */}
      <aside className="w-72 bg-secondary text-secondary-foreground p-4 flex flex-col overflow-y-auto">
        <h2 className="font-bold mb-2 text-sm">Chats</h2>

        {/* Recent (unassigned) Chats */}
        <div className="mb-4 space-y-1">
          {recentChats.length === 0 ? (
            <p className="text-xs text-muted-foreground">No unassigned chats.</p>
          ) : (
            recentChats.map((chat) => {
              const active = pathname === `/chats/${chat.id}`;
              return (
                <div
                  key={chat.id}
                  className={`flex items-center rounded px-2 py-1 cursor-grab
                    ${active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}
                  `}
                  draggable
                  onDragStart={(e) => onDragStartChat(e, chat)}
                >
                  {renamingChatId === chat.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-8"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => commitRename(chat.id!)}
                      >
                        Save
                      </Button>
                      <Button variant="destructive" size="sm" onClick={cancelRename}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center w-full">
                      <Link href={`/chats/${chat.id}`} className="flex-1 text-sm">
                        {chat.name || `Chat #${chat.id}`}
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          startRename(chat.id!, chat.name || `Chat #${chat.id}`)
                        }
                      >
                        Rename
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <Button onClick={handleNewChat} className="mb-4 w-full" size="sm">
          + New Chat
        </Button>

        <Separator className="my-2" />

        {/* Projects heading + plus icon */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-sm">Projects</h2>
          <Dialog open={openProjectDialog} onOpenChange={setOpenProjectDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new project</DialogTitle>
                <DialogDescription>Give it a name, e.g. "Mobile App."</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Input
                  placeholder="Project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setOpenProjectDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createProject}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {projects.length === 0 ? (
          <p className="text-xs text-muted-foreground">No projects yet.</p>
        ) : (
          <Accordion type="multiple" className="space-y-1">
            {projects.map((proj) => {
              const chatsForProject = projectChats[proj.id!] || [];
              return (
                <AccordionItem key={proj.id} value={`project-${proj.id}`}>
                  <AccordionTrigger className="text-sm flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    {proj.name}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div
                      className="mt-2"
                      onDragOver={(e) => onDragOverProject(e)}
                      onDrop={(e) => onDropProject(e, proj.id!)}
                    >
                      {chatsForProject.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          (No chats in this project)
                        </p>
                      ) : (
                        chatsForProject.map((chat) => {
                          const active = pathname === `/chats/${chat.id}`;
                          return (
                            <div
                              key={chat.id}
                              className={`flex items-center rounded px-2 py-1
                                ${active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}
                              `}
                            >
                              {renamingChatId === chat.id ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <Input
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    className="h-8"
                                  />
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => commitRename(chat.id!)}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={cancelRename}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex justify-between items-center w-full">
                                  <Link href={`/chats/${chat.id}`} className="flex-1 text-sm">
                                    {chat.name || `Chat #${chat.id}`}
                                  </Link>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      startRename(chat.id!, chat.name || `Chat #${chat.id}`)
                                    }
                                  >
                                    Rename
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 rounded-xl border border-zinc-200 bg-main-background mt-2 ml-0 mr-2 mb-1">
        <div className="h-full overflow-y-auto rounded-xl">
          {children}
        </div>
      </main>
    </div>
  );
}
