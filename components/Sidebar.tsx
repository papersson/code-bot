"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { db, Chat, Project } from "@/db/dexie";
import { useSidebar } from "@/hooks/useSidebar";

// Shadcn UI
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
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

// Lucide icons
import { Plus, Folder, Pencil, X, LogIn, LogOut } from "lucide-react";

export default function Sidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const { currentChatId } = useSidebar();

  const userEmail = session?.user?.email;

  // All unassigned chats (projectId == null)
  const [recentChats, setRecentChats] = useState<Chat[]>([]);
  // Grouped assigned chats
  const [projectChats, setProjectChats] = useState<Record<number, Chat[]>>({});
  // Projects
  const [projects, setProjects] = useState<Project[]>([]);

  // For creating new project
  const [openProjectDialog, setOpenProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // Renaming
  const [renamingChatId, setRenamingChatId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Force re-render on event
  const [reloadKey, setReloadKey] = useState(0);

  // Load data from Dexie
  useEffect(() => {
    if (!userEmail) return;

    async function loadData() {
      const allChats = await db.chats.where("userId").equals(userEmail).toArray();

      // separate unassigned from assigned
      const unassigned = allChats
        .filter((c) => !c.projectId)
        .sort(sortByRecent);
      setRecentChats(unassigned);

      // group by project
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

      // load projects
      const allProjects = await db.projects.orderBy("id").toArray();
      setProjects(allProjects);
    }

    loadData();
  }, [userEmail, renamingChatId, reloadKey]);

  // Listen for "chat-created" event
  useEffect(() => {
    function handleChatCreated() {
      // Simply increment reloadKey => triggers re-fetch
      setReloadKey((prev) => prev + 1);
    }
    window.addEventListener("chat-created", handleChatCreated);
    return () => {
      window.removeEventListener("chat-created", handleChatCreated);
    };
  }, []);

  function sortByRecent(a: Chat, b: Chat) {
    const ad = a.updatedAt ?? a.createdAt ?? 0;
    const bd = b.updatedAt ?? b.createdAt ?? 0;
    return new Date(bd).getTime() - new Date(ad).getTime();
  }

  // If not signed in
  if (!session) {
    return (
      <aside className="w-72 bg-secondary text-secondary-foreground p-4 flex flex-col overflow-y-auto">
        <p className="mb-4">Please sign in to view chats.</p>
        <Button onClick={() => signIn()} className="p-2">
          <LogIn className="w-4 h-4" />
        </Button>
      </aside>
    );
  }

  // new chat
  async function handleNewChat() {
    const now = new Date();
    const newId = await db.chats.add({
      userId: userEmail!,
      name: "New Chat",
      createdAt: now,
      updatedAt: now,
    });
    window.dispatchEvent(new Event("chat-created"));
    router.push(`/chats/${newId}`);
  }

  // Drag/Drop
  function onDragStartChat(e: React.DragEvent<HTMLDivElement>, chat: Chat) {
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

    const now = new Date();
    await db.chats.update(chatId, { projectId, updatedAt: now });
    setReloadKey((prev) => prev + 1);
  }

  // create project
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
    setReloadKey((prev) => prev + 1);
  }

  // rename
  function startRename(chatId: number, currentName: string) {
    setRenamingChatId(chatId);
    setRenameValue(currentName);
  }
  async function commitRename(chatId: number) {
    if (!renameValue.trim()) return;
    const now = new Date();
    await db.chats.update(chatId, { name: renameValue, updatedAt: now });
    setRenamingChatId(null);
    setRenameValue("");
    setReloadKey((prev) => prev + 1);
  }
  function cancelRename() {
    setRenamingChatId(null);
    setRenameValue("");
  }

  // delete chat
  async function deleteChat(chatId: number) {
    await db.chats.delete(chatId);
    setReloadKey((prev) => prev + 1);
  }

  // delete project
  async function deleteProject(projectId: number) {
    // unassign all chats in that project
    const pChats = await db.chats.where("projectId").equals(projectId).toArray();
    await Promise.all(
      pChats.map((c) => db.chats.update(c.id!, { projectId: null }))
    );

    await db.projects.delete(projectId);
    setReloadKey((prev) => prev + 1);
  }

  return (
    <aside className="w-72 bg-secondary text-secondary-foreground p-4 flex flex-col overflow-y-auto">
      {/* PROJECTS */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Projects</h2>
        <Dialog open={openProjectDialog} onOpenChange={setOpenProjectDialog}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new project</DialogTitle>
              <DialogDescription>Give it a name, e.g. “Mobile App.”</DialogDescription>
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
        <p className="text-xs text-muted-foreground mb-2">No projects yet.</p>
      ) : (
        <Accordion
          type="multiple"
          className="space-y-0.5 mb-2 [&>*]:border-none"
        >
          {projects.map((proj) => {
            const chatsForProject = projectChats[proj.id!] || [];
            return (
              <AccordionItem key={proj.id} value={`project-${proj.id}`}>
                <div className="flex items-center justify-between group">
                  <AccordionTrigger className="text-sm hover:no-underline flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <Folder className="w-3.5 h-3.5" />
                      {proj.name}
                    </div>
                  </AccordionTrigger>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProject(proj.id!);
                    }}
                  >
                    <X className="w-3.5 h-3.5 text-red-500 hover:text-red-600" />
                  </Button>
                </div>
                <AccordionContent>
                  <div
                    className="mt-1"
                    onDragOver={onDragOverProject}
                    onDrop={(e) => onDropProject(e, proj.id!)}
                  >
                    {chatsForProject.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        (No chats in this project)
                      </p>
                    ) : (
                      chatsForProject.map((chat) => {
                        const active = chat.id === currentChatId;
                        return (
                          <div
                            key={chat.id}
                            draggable
                            onDragStart={(evt) => onDragStartChat(evt, chat)}
                            className={`group flex items-center rounded px-2 py-1
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
                                <Button
                                  asChild
                                  variant="ghost"
                                  className="px-0 py-0 flex-1 text-left"
                                >
                                  <Link
                                    href={`/chats/${chat.id}`}
                                    className="text-sm overflow-hidden text-ellipsis whitespace-nowrap"
                                  >
                                    {chat.name || `Chat #${chat.id}`}
                                  </Link>
                                </Button>
                                <div className="flex gap-0.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      startRename(
                                        chat.id!,
                                        chat.name || `Chat #${chat.id}`
                                      )
                                    }
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7"
                                    onClick={() => deleteChat(chat.id!)}
                                  >
                                    <X className="w-3.5 h-3.5 text-red-500 hover:text-red-600" />
                                  </Button>
                                </div>
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

      {/* CHATS */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Chats</h2>
        <Button variant="ghost" size="sm" className="h-7 w-7" onClick={handleNewChat}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="space-y-0.5">
        {recentChats.length === 0 ? (
          <p className="text-xs text-muted-foreground">No unassigned chats.</p>
        ) : (
          recentChats.map((chat) => {
            const active = chat.id === currentChatId;
            return (
              <div
                key={chat.id}
                draggable
                onDragStart={(evt) => onDragStartChat(evt, chat)}
                className={`group flex items-center rounded px-2 py-1 cursor-grab
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
                    <Button variant="destructive" size="sm" onClick={cancelRename}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center w-full">
                    <Button
                      asChild
                      variant="ghost"
                      className="px-0 py-0 flex-1 text-left"
                    >
                      <Link
                        href={`/chats/${chat.id}`}
                        className="text-sm overflow-hidden text-ellipsis whitespace-nowrap"
                      >
                        {chat.name || `Chat #${chat.id}`}
                      </Link>
                    </Button>
                    <div className="flex gap-0.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7"
                        onClick={() =>
                          startRename(
                            chat.id!,
                            chat.name || `Chat #${chat.id}`
                          )
                        }
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7"
                        onClick={() => deleteChat(chat.id!)}
                      >
                        <X className="w-3.5 h-3.5 text-red-500 hover:text-red-600" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* FOOTER: sign out => icon only */}
      <div className="mt-auto pt-4 border-t border-muted-foreground flex items-center justify-between">
        <span className="text-sm">Signed in as {session.user?.email}</span>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center justify-center p-2"
          onClick={() => signOut()}
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </aside>
  );
}
