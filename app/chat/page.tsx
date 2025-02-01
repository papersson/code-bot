"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "next-auth/react";
import { db, Chat, ChatMessage } from "@/db/dexie";

export default function ChatPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? "";
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Attempt to find or create a Chat row for this user
  async function getOrCreateChat(userEmail: string): Promise<Chat> {
    // Find existing chat by userId
    let chat = await db.chats.where("userId").equals(userEmail).first();
    if (!chat) {
      // Create new chat
      const id = await db.chats.add({
        userId: userEmail,
        createdAt: new Date(),
      });
      chat = { id, userId: userEmail, createdAt: new Date() };
    }
    return chat;
  }

  // Load messages when userEmail is available
  useEffect(() => {
    if (!userEmail) return;

    (async () => {
      const chat = await getOrCreateChat(userEmail);
      // load all messages for that chat
      const msgs = await db.chatMessages
        .where("chatId")
        .equals(chat.id!)
        .sortBy("id"); // or .toArray() if you want unsorted
      setMessages(msgs);
    })();
  }, [userEmail]);

  async function handleSend() {
    if (!input.trim() || !userEmail) return;

    const chat = await getOrCreateChat(userEmail);

    // Insert user's message
    const userMsgId = await db.chatMessages.add({
      chatId: chat.id!,
      sender: "user",
      content: input,
      createdAt: new Date(),
    });
    // Reload messages from Dexie
    const updatedMsgs = await db.chatMessages
      .where("chatId")
      .equals(chat.id!)
      .sortBy("id");
    setMessages(updatedMsgs);
    setInput("");

    // Hardcoded bot reply
    setTimeout(async () => {
      await db.chatMessages.add({
        chatId: chat.id!,
        sender: "bot",
        content: "Hello!",
        createdAt: new Date(),
      });
      // Reload messages
      const moreMsgs = await db.chatMessages
        .where("chatId")
        .equals(chat.id!)
        .sortBy("id");
      setMessages(moreMsgs);
    }, 500);
  }

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p className="text-red-600">Please sign in to access the chat.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Chatbot</h1>
      <div className="border rounded p-4 h-80 overflow-y-auto mb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-2 ${
              msg.sender === "bot" ? "text-blue-600" : "text-gray-800"
            }`}
          >
            <strong>{msg.sender === "bot" ? "Bot" : "You"}:</strong> {msg.content}
            <div className="text-xs text-gray-500">
              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ""}
            </div>
          </div>
        ))}
      </div>
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
