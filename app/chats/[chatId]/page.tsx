"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { db, ChatMessage, Chat, Project } from "@/db/dexie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Container for centered content */}
      <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
        {/* Message list */}
        <div className="flex-1 overflow-y-auto p-4">
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

        {/* Input box - fixed at bottom */}
        <Textarea
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="resize-none bg-background-main min-h-[90px] max-h-[200px] rounded-xl w-full border mb-4 focus:ring-0 p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.15)] transition-shadow"
          rows={1}
        />
      </div>
    </div>
  );
}
