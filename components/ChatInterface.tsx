// components/ChatInterface.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSidebar } from "@/hooks/useSidebar";
import { db } from "@/db/dexie";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface Props {
  /**
   * If null => ephemeral mode
   * If a number => an existing or to-be-loaded Dexie chat
   */
  initialChatId: number | null;
  /**
   * Optional name to use if we need to create the chat in Dexie
   * (e.g. "Home Chat" vs. "New Chat"). 
   * If not provided, defaults to "New Chat."
   */
  defaultChatName?: string;
}

/**
 * ChatInterface can be used by both the Home page
 * (ephemeral at first) AND the [chatId] detail page
 * (always persisted).
 */
export default function ChatInterface({
  initialChatId,
  defaultChatName = "New Chat",
}: Props) {
  const { data: session } = useSession();
  const { setCurrentChatId } = useSidebar();

  // We'll store the "real" chatId if/when we create or load from Dexie.
  // If initialChatId is a valid number, we do "persisted mode" right away.
  // If it's null, we start ephemeral and only become "persisted" if we
  // actually create a new chat on first send.
  const [chatId, setChatId] = useState<number | null>(initialChatId);

  // For ephemeral usage: we store messages in memory
  // until we either convert to Dexie or we are already in Dexie mode.
  interface EphemeralMessage {
    id?: number;
    sender: "user" | "bot";
    content: string;
    createdAt: Date;
  }
  const [messages, setMessages] = useState<EphemeralMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");

  // If we already have a numeric chatId (persisted mode),
  // load existing messages from Dexie on mount (and on chatId change).
  useEffect(() => {
    if (!session?.user?.email) return;
    if (chatId === null) return; // ephemeral => skip
    // We do have a numeric chatId => load from Dexie.
    setLoading(true);

    (async () => {
      const existingChat = await db.chats.get(chatId!);
      if (!existingChat) {
        // If the chat doesn't exist, you might do a 404 or just ephemeral fallback.
        // For now, let's just say "Chat not found" or do ephemeral fallback.
        setMessages([]);
        setLoading(false);
        return;
      }

      // Mark this chat as active in the sidebar
      setCurrentChatId(chatId!);

      const storedMessages = await db.chatMessages
        .where("chatId")
        .equals(chatId!)
        .sortBy("id");

      // Convert Dexie messages to ephemeral
      const ephemeral = storedMessages.map((m) => ({
        id: m.id,
        sender: m.sender === "bot" ? "bot" : "user",
        content: m.content,
        createdAt: m.createdAt || new Date(),
      }));
      setMessages(ephemeral);
      setLoading(false);
    })();
  }, [chatId, session, setCurrentChatId]);

  // If user is not signed in, just show a prompt
  if (!session) {
    return <div className="p-4">Please sign in to access the chat.</div>;
  }

  if (loading) {
    return <div className="p-4">Loading chat...</div>;
  }

  // MAIN SEND LOGIC
  async function handleSend() {
    const content = input.trim();
    if (!content) return;
    setInput("");

    // If ephemeral => we have chatId == null
    if (chatId === null) {
      // FIRST TIME: create a brand-new Dexie chat
      const now = new Date();
      const newChatId = await db.chats.add({
        userId: session.user.email!,
        name: defaultChatName,
        createdAt: now,
        updatedAt: now,
      });
      setChatId(newChatId);
      setCurrentChatId(newChatId);

      // Dispatch so the sidebar updates immediately
      window.dispatchEvent(new Event("chat-created"));

      // Insert the user message in Dexie
      const msgId = await db.chatMessages.add({
        chatId: newChatId,
        sender: "user",
        content,
        createdAt: now,
        updatedAt: now,
      });
      // Also reflect it in ephemeral local state
      setMessages((prev) => [
        ...prev,
        { id: msgId, sender: "user", content, createdAt: now },
      ]);

      // Fake bot reply
      setTimeout(async () => {
        const botNow = new Date();
        const botMsgId = await db.chatMessages.add({
          chatId: newChatId,
          sender: "bot",
          content: "Hello from your new chat!",
          createdAt: botNow,
          updatedAt: botNow,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: botMsgId,
            sender: "bot",
            content: "Hello from your new chat!",
            createdAt: botNow,
          },
        ]);
        await db.chats.update(newChatId, { updatedAt: botNow });
      }, 600);

      return;
    }

    // Otherwise, we already have a numeric chatId => fully persisted mode
    const now = new Date();
    const msgId = await db.chatMessages.add({
      chatId,
      sender: "user",
      content,
      createdAt: now,
      updatedAt: now,
    });
    await db.chats.update(chatId, { updatedAt: now });

    // Add to ephemeral for immediate UI
    setMessages((prev) => [
      ...prev,
      { id: msgId, sender: "user", content, createdAt: now },
    ]);

    // Simulate bot reply
    setTimeout(async () => {
      const botNow = new Date();
      const botMsgId = await db.chatMessages.add({
        chatId,
        sender: "bot",
        content: "Hello again from your existing chat!",
        createdAt: botNow,
        updatedAt: botNow,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          sender: "bot",
          content: "Hello again from your existing chat!",
          createdAt: botNow,
        },
      ]);
      await db.chats.update(chatId, { updatedAt: botNow });
    }, 600);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col h-full max-w-3xl mx-auto w-full relative px-4 pb-4">
        {/* MESSAGES */}
        <div className="flex-1 pt-8">
          {messages.length > 0 ? (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-3 ${
                  msg.sender === "bot" ? "text-blue-600" : "text-gray-800"
                }`}
              >
                <div className="font-semibold">
                  {msg.sender === "bot" ? "Bot" : "You"}
                </div>
                <div>{msg.content}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {msg.createdAt.toLocaleTimeString()}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500">
              {chatId === null
                ? "This is ephemeral (not in Dexie) until you send a message!"
                : "No messages yet. Type something below to start!"}
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div className="sticky bottom-0 left-0 right-0 bg-background-main pt-4 ">
          <div className="flex items-center gap-2">
            <Textarea
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="resize-none min-h-[90px] max-h-[200px]
                         rounded-t-xl w-full border p-4"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
