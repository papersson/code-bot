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
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";

// Lucide icons
import { Plus, Folder, Pencil, X, LogIn, LogOut, MessageSquare, ChevronRight } from "lucide-react";

interface ChatItemProps {
  chat: Chat;
  active: boolean;
  onRename: (chatId: number, currentName: string) => void;
  onDelete: (chatId: number) => void;
  renamingChatId: number | null;
  renameValue: string;
  setRenameValue: (value: string) => void;
  commitRename: (chatId: number) => void;
  cancelRename: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, chat: Chat) => void;
}

function ChatItem({
  chat,
  active,
  onRename,
  onDelete,
  renamingChatId,
  renameValue,
  setRenameValue,
  commitRename,
  cancelRename,
  onDragStart,
}: ChatItemProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, chat)}
      className={`
        group flex items-center rounded-lg px-2 py-1.5
        cursor-grab transition-all duration-200
        ${active ? "bg-accent text-accent-foreground shadow-sm" : "hover:bg-accent/20"}
      `}
    >
      {renamingChatId === chat.id ? (
        <div className="flex-1 flex items-center gap-2">
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="h-8 rounded-lg"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => commitRename(chat.id!)}
            className="rounded-lg"
          >
            Save
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={cancelRename}
            className="rounded-lg"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex justify-between items-center w-full">
          <div className="flex-1 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 shrink-0 text-blue-400 fill-current" />
            <Button
              asChild
              variant="ghost"
              className={`
                px-0 py-0 flex-1 text-left justify-start h-auto rounded-lg
                ${active ? "hover:bg-accent/90" : "hover:bg-accent/30"}
                transition-colors duration-200
              `}
            >
              <Link
                href={`/chats/${chat.id}`}
                className="text-sm overflow-hidden text-ellipsis whitespace-nowrap"
              >
                {chat.name || `Chat #${chat.id}`}
              </Link>
            </Button>
          </div>
          <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-accent/50 rounded-lg"
              onClick={() => onRename(chat.id!, chat.name || `Chat #${chat.id}`)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
              onClick={() => onDelete(chat.id!)}
            >
              <X className="w-3.5 h-3.5 text-red-500 hover:text-red-600" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const { currentChatId, isOpen } = useSidebar();

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

  // Renaming project
  const [renamingProjectId, setRenamingProjectId] = useState<number | null>(null);
  const [projectRenameValue, setProjectRenameValue] = useState("");

  // Force re-render on event
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userEmail) return;

    async function loadData() {
      const allChats = await db.chats
        .where("userId")
        .equals(userEmail as string)
        .toArray();

      // separate unassigned from assigned
      const unassigned = allChats.filter((c) => !c.projectId).sort(sortByRecent);
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
      <aside className="w-72 bg-sidebar text-sidebar-foreground p-4 flex flex-col overflow-y-auto border-r border-sidebar-border">
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

  // rename project
  function startProjectRename(projectId: number, currentName: string) {
    setRenamingProjectId(projectId);
    setProjectRenameValue(currentName);
  }
  async function commitProjectRename(projectId: number) {
    if (!projectRenameValue.trim()) return;
    const now = new Date();
    await db.projects.update(projectId, { name: projectRenameValue, updatedAt: now });
    setRenamingProjectId(null);
    setProjectRenameValue("");
    setReloadKey((prev) => prev + 1);
  }
  function cancelProjectRename() {
    setRenamingProjectId(null);
    setProjectRenameValue("");
  }

  return (
    <aside
      className={`
        flex flex-col overflow-y-auto
         text-sidebar-foreground
        p-3 w-72
        transition-[width,opacity,transform] duration-200 ease-in-out
        ${isOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 w-0"}
      `}
    >
      {/* PROJECTS header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
          Projects
        </h2>
        <Dialog open={openProjectDialog} onOpenChange={setOpenProjectDialog}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new project</DialogTitle>
              <DialogDescription>
                Give it a name, e.g. &quot;Mobile App.&quot;
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Input
                placeholder="Project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setOpenProjectDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={createProject}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <p className="text-xs text-muted-foreground mb-2">
          No projects yet.
        </p>
      ) : (
        <Accordion
          type="multiple"
          className="space-y-0.5 mb-2 [&>*]:border-none [&_[data-state]]:no-underline [&_button]:!p-0"
        >
          {projects.map((proj) => {
            const chatsForProject = projectChats[proj.id!] || [];
            return (
              <AccordionItem key={proj.id} value={`project-${proj.id}`}>
                <div className="flex items-center justify-between group">
                  <AccordionTrigger className="text-sm p-0 flex-1 hover:no-underline data-[state=open]:text-accent-foreground [&>svg]:hidden">
                    {renamingProjectId === proj.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={projectRenameValue}
                          onChange={(e) => setProjectRenameValue(e.target.value)}
                          className="h-8 rounded-lg"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => commitProjectRename(proj.id!)}
                          className="rounded-lg"
                        >
                          Save
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={cancelProjectRename}
                          className="rounded-lg"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center w-full pr-2 py-1.5 rounded-lg transition-colors hover:bg-accent/20">
                        <div className="flex-1 flex items-center gap-2.5 min-w-0">
                          <Folder className="w-[15px] h-[15px] shrink-0 text-amber-400/90 fill-current transition-all duration-200 
                            group-hover:text-amber-500/90 
                            group-[[data-state=open]]:text-amber-500/90 
                            group-[[data-state=open]]:scale-110" />
                          <span className="truncate font-medium text-[13px]">{proj.name}</span>
                        </div>
                      </div>
                    )}
                  </AccordionTrigger>
                  {!renamingProjectId && (
                    <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-accent/50 rounded-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          startProjectRename(proj.id!, proj.name);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProject(proj.id!);
                        }}
                      >
                        <X className="w-3.5 h-3.5 text-red-500 hover:text-red-600" />
                      </Button>
                    </div>
                  )}
                </div>
                <AccordionContent className="pl-4 relative">
                  <div className="absolute left-[11px] top-0 bottom-2 w-px bg-border" />
                  <div
                    className="mt-1 relative"
                    onDragOver={onDragOverProject}
                    onDrop={(e) => onDropProject(e, proj.id!)}
                  >
                    {chatsForProject.length === 0 ? (
                      <p className="text-xs text-muted-foreground pl-2">
                        (No chats in this project)
                      </p>
                    ) : (
                      chatsForProject.map((chat) => (
                        <ChatItem
                          key={chat.id}
                          chat={chat}
                          active={chat.id === currentChatId}
                          onRename={startRename}
                          onDelete={deleteChat}
                          renamingChatId={renamingChatId}
                          renameValue={renameValue}
                          setRenameValue={setRenameValue}
                          commitRename={commitRename}
                          cancelRename={cancelRename}
                          onDragStart={onDragStartChat}
                        />
                      ))
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Separator between Projects and Chats */}
      <Separator className="my-3" />

      {/* CHATS header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
          Chats
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 rounded-lg"
          onClick={handleNewChat}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="space-y-0.5">
        {recentChats.length === 0 ? (
          <p className="text-xs text-muted-foreground">No unassigned chats.</p>
        ) : (
          recentChats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              active={chat.id === currentChatId}
              onRename={startRename}
              onDelete={deleteChat}
              renamingChatId={renamingChatId}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              commitRename={commitRename}
              cancelRename={cancelRename}
              onDragStart={onDragStartChat}
            />
          ))
        )}
      </div>

      {/* FOOTER */}
      <div className="mt-auto pt-4 border-t border-muted-foreground flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Signed in as {session.user?.email}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center justify-center p-2 rounded-lg"
          onClick={() => signOut()}
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </aside>
  );
}
