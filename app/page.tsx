"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { db, Chat, ChatMessage } from "@/db/dexie";
import { Textarea } from "@/components/ui/textarea";

export default function Home() {
  const { data: session } = useSession();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (!session?.user?.email) return;

    // Only load a Home Chat if it already exists (i.e. user has previously sent messages).
    (async function loadExistingHomeChat() {
      const existingChat = await db.chats
        .where({ userId: session.user.email, name: "Home Chat" })
        .first();

      if (existingChat) {
        setChat(existingChat);

        const msgs = await db.chatMessages
          .where("chatId")
          .equals(existingChat.id!)
          .sortBy("id");
        setMessages(msgs);
      }
    })();
  }, [session]);

  if (!session) {
    return <div className="p-4">Please sign in to access the chat.</div>;
  }

  // Handle sending a user message
  async function handleSend() {
    if (!input.trim()) return;

    // If there's no Home Chat yet, create it now.
    let newChat = chat;
    if (!newChat) {
      const now = new Date();
      const newChatId = await db.chats.add({
        userId: session.user?.email || "",
        name: "Home Chat",
        createdAt: now,
        updatedAt: now,
      });
      newChat = await db.chats.get(newChatId);
      setChat(newChat || null);
    }

    if (!newChat) return; // safety check

    const now = new Date();
    // Add the user message
    await db.chatMessages.add({
      chatId: newChat.id!,
      sender: "user",
      content: input.trim(),
      createdAt: now,
      updatedAt: now,
    });

    // Update chat's updatedAt
    await db.chats.update(newChat.id!, { updatedAt: now });
    setInput("");

    // Reload messages
    const updatedMsgs = await db.chatMessages
      .where("chatId")
      .equals(newChat.id!)
      .sortBy("id");
    setMessages(updatedMsgs);

    // Simulate a bot reply
    setTimeout(async () => {
      const botNow = new Date();
      await db.chatMessages.add({
        chatId: newChat!.id!,
        sender: "bot",
        content: "Hello from the home chat!",
        createdAt: botNow,
        updatedAt: botNow,
      });
      await db.chats.update(newChat!.id!, { updatedAt: botNow });

      const moreMsgs = await db.chatMessages
        .where("chatId")
        .equals(newChat!.id!)
        .sortBy("id");
      setMessages(moreMsgs);
    }, 800);
  }

  // If no Home Chat yet and no messages, show a placeholder
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="flex flex-col h-full max-w-3xl mx-auto w-full relative">
        {/* Messages or placeholder */}
        <div className="flex-1 p-4 pb-[120px]">
          {hasMessages ? (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-3 ${msg.sender === "bot" ? "text-blue-600" : "text-gray-800"}`}
              >
                <div className="font-semibold">
                  {msg.sender === "bot" ? "Bot" : "You"}
                </div>
                <div>{msg.content}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ""}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500">
              No chat yet. Type something below to start!
            </div>
          )}
        </div>

        {/* Input box - fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0">
          <div className="max-w-3xl mx-auto w-full px-4">
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
              className="resize-none bg-background-main min-h-[90px] max-h-[200px]
                         rounded-t-xl w-full border focus:ring-0 p-4
                         shadow-[0_2px_12px_-4px_rgba(0,0,0,0.1)]
                         hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.15)]
                         transition-shadow"
              rows={1}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
