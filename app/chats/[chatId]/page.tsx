"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { db, ChatMessage, Chat, Project } from "@/db/dexie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function ChatDetailPage() {
  const { data: session } = useSession();
  const { chatId } = useParams() as { chatId: string };

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  useEffect(() => {
    if (!session?.user?.email) return;
    if (!chatId) return;

    // Load chat
    db.chats.get(Number(chatId)).then((foundChat) => {
      if (foundChat) {
        setChat(foundChat);
        setSelectedProjectId(foundChat.projectId ?? null);
      }
    });

    // Load messages
    db.chatMessages
      .where("chatId")
      .equals(Number(chatId))
      .sortBy("id")
      .then((msgs) => {
        setMessages(msgs);
      });

    // Load projects for the drop-down
    db.projects.toArray().then(setProjects);
  }, [chatId, session?.user?.email]);

  if (!session) {
    return <div className="p-4">Please sign in to access the chat.</div>;
  }

  if (!chat) {
    return <div className="p-4">Loading chat...</div>;
  }

  // Send message
  async function handleSend() {
    if (!input.trim()) return;
    const now = new Date();
    await db.chatMessages.add({
      chatId: Number(chatId),
      sender: "user",
      content: input,
      createdAt: now,
      updatedAt: now,
    });
    await db.chats.update(Number(chatId), { updatedAt: now });
    setInput("");

    // Reload
    const updatedMsgs = await db.chatMessages
      .where("chatId")
      .equals(Number(chatId))
      .sortBy("id");
    setMessages(updatedMsgs);

    // Fake a bot reply
    setTimeout(async () => {
      const botNow = new Date();
      await db.chatMessages.add({
        chatId: Number(chatId),
        sender: "bot",
        content: "Hello! (pretend I'm AI)",
        createdAt: botNow,
        updatedAt: botNow,
      });
      await db.chats.update(Number(chatId), { updatedAt: botNow });
      const moreMsgs = await db.chatMessages
        .where("chatId")
        .equals(Number(chatId))
        .sortBy("id");
      setMessages(moreMsgs);
    }, 800);
  }

  // Handle project selection
  async function handleProjectSelect(value: string) {
    const pid = value === "null" ? null : Number(value);
    setSelectedProjectId(pid);
    const now = new Date();
    await db.chats.update(Number(chatId), { projectId: pid, updatedAt: now });
    const refreshed = await db.chats.get(Number(chatId));
    if (refreshed) setChat(refreshed);
  }

  return (
    <div className="p-4 flex flex-col h-full max-h-screen">
      {/* Header row: Chat title & project selection */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-bold">
          {chat.name || `Chat #${chat.id}`}
        </h1>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Project:</label>
          <Select value={selectedProjectId?.toString() ?? "null"} onValueChange={handleProjectSelect}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="No project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="null">No project</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id?.toString() ?? ""}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Message list */}
      <div className="border rounded p-4 mb-4 flex-1 overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-3 ${
              msg.sender === "bot" ? "text-blue-600" : "text-gray-800"
            }`}
          >
            <div className="font-semibold">{msg.sender === "bot" ? "Bot" : "You"}</div>
            <div>{msg.content}</div>
            <div className="text-xs text-gray-500 mt-1">
              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ""}
            </div>
          </div>
        ))}
      </div>

      {/* Input box */}
      <div className="flex space-x-2">
        <Input
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button onClick={handleSend}>Send</Button>
      </div>
    </div>
  );
}
