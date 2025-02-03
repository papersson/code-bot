"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSidebar } from "@/hooks/useSidebar";
import { db } from "@/db/dexie";
import { Textarea } from "@/components/ui/textarea";
import { LoadingDots } from "@/components/ui/loading-dots";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area"; // from shadcn
import { EphemeralMessage } from "./types";
import { ChatMessageItem } from "./ChatMessageItem";

interface Props {
  initialChatId: number;
  defaultChatName?: string;
}

export default function ChatInterface({
  initialChatId,
  defaultChatName = "New Chat",
}: Props) {
  const { data: session } = useSession();
  const { setCurrentChatId } = useSidebar();

  // We'll auto-scroll to this at the bottom of message list
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);

  // Dexie & local state
  const [chatId] = useState<number>(initialChatId);
  const [messages, setMessages] = useState<EphemeralMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");

  // Model selection
  const [selectedModel, setSelectedModel] = useState("o3-mini-high");

  // Chat metadata
  const [chatExists, setChatExists] = useState(true);
  const [chatName, setChatName] = useState(defaultChatName);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!session?.user?.email) {
      setLoading(false);
      return;
    }
    setLoading(true);

    (async () => {
      const chat = await db.chats.get(chatId);
      if (!chat) {
        setChatExists(false);
        setLoading(false);
        return;
      }
      setCurrentChatId(chatId);
      setChatName(chat.name || defaultChatName);

      const stored = await db.chatMessages
        .where("chatId")
        .equals(chatId)
        .sortBy("id");

      const ephemeral: EphemeralMessage[] = stored.map((m) => ({
        id: m.id,
        sender: m.sender as "user" | "bot",
        content: m.content,
        createdAt: m.createdAt || new Date(),
        pending: false,
      }));
      setMessages(ephemeral);
      setLoading(false);
    })();
  }, [chatId, session, setCurrentChatId, defaultChatName]);

  function mapToApiMessages(msgs: EphemeralMessage[]) {
    return msgs.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.content,
    }));
  }

  async function generateTitleInBackground(userMsg: string, botMsg: string) {
    try {
      const titleRes = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: userMsg + "\n\n" + botMsg }),
      });

      if (!titleRes.ok) {
        console.error("❌ Title API error:", await titleRes.text());
        return;
      }

      const shortTitle = await titleRes.text();
      await db.chats.update(chatId, {
        name: shortTitle,
        updatedAt: new Date(),
      });
      window.dispatchEvent(new Event("chat-updated"));
    } catch (error) {
      console.error("❌ Failed to generate chat title:", error);
    }
  }

  async function handleSend() {
    const content = input.trim();
    if (!content) return;
    setInput("");

    const now = new Date();

    // Save user message
    const userMsgId = await db.chatMessages.add({
      chatId,
      sender: "user",
      content,
      createdAt: now,
      updatedAt: now,
    });
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: "user", content, createdAt: now },
    ]);

    // Pending bot message
    const tempId = `pending-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { tempId, sender: "bot", content: "", createdAt: now, pending: true },
    ]);

    try {
      const allMessages = [
        ...messages,
        { sender: "user" as const, content, createdAt: now },
      ];
      const body = {
        messages: mapToApiMessages(allMessages),
        model: selectedModel,
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok || !response.body) {
        console.error("❌ Stream error:", response.status);
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      // Stream the reply
      let lastFlushTime = Date.now();
      let partialContent = "";
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        partialContent += chunk;

        const nowTime = Date.now();
        if (nowTime - lastFlushTime >= 50) {
          setMessages((prev) => {
            const newMsgs = [...prev];
            const lastMsg = newMsgs[newMsgs.length - 1];
            if (lastMsg?.pending) {
              lastMsg.content = partialContent;
            }
            return newMsgs;
          });
          lastFlushTime = nowTime;
        }
      }

      // Final flush
      setMessages((prev) => {
        const newMsgs = [...prev];
        const lastMsg = newMsgs[newMsgs.length - 1];
        if (lastMsg?.pending) {
          lastMsg.content = partialContent;
        }
        return newMsgs;
      });

      // Save final
      const botNow = new Date();
      const botMsgId = await db.chatMessages.add({
        chatId,
        sender: "bot",
        content: partialContent,
        createdAt: botNow,
        updatedAt: botNow,
      });
      setMessages((prev) => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = {
          id: botMsgId,
          sender: "bot",
          content: partialContent,
          createdAt: botNow,
          pending: false,
        };
        return newMsgs;
      });

      // Update chat time
      await db.chats.update(chatId, { updatedAt: botNow });

      // If first user–bot exchange, maybe rename chat
      if (messages.length === 0 && isPlaceholderName(chatName)) {
        generateTitleInBackground(content, partialContent);
      }
    } catch (err) {
      console.error("❌ Error streaming bot reply:", err);
      setMessages((prev) => prev.slice(0, -1));
    }
  }

  async function handleEditSubmit(messageId: number) {
    if (!editInput.trim()) return;
    const now = new Date();

    try {
      await db.chatMessages.update(messageId, {
        content: editInput,
        updatedAt: now,
      });

      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;
      const messagesBeforeEdit = messages.slice(0, idx + 1).map((m) =>
        m.id === messageId ? { ...m, content: editInput } : m
      );
      setMessages(messagesBeforeEdit);

      setEditingMessageId(null);
      setEditInput("");

      // Remove subsequent
      const subsequent = await db.chatMessages
        .where("chatId")
        .equals(chatId)
        .filter((msg) => msg.id! > messageId)
        .toArray();
      await Promise.all(
        subsequent.map((msg) => db.chatMessages.delete(msg.id!))
      );

      // New pending
      const tempId = `pending-edit-${Date.now()}`;
      setMessages([
        ...messagesBeforeEdit,
        { tempId, sender: "bot", content: "", createdAt: new Date(), pending: true },
      ]);

      // Re-send
      const body = {
        messages: mapToApiMessages(messagesBeforeEdit),
        model: selectedModel,
      };
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok || !response.body) {
        console.error("❌ Stream error (edit):", response.status);
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      let lastFlushTime = Date.now();
      let partialContent = "";
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        partialContent += chunk;

        const nowTime = Date.now();
        if (nowTime - lastFlushTime >= 50) {
          setMessages((prev) => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1].content = partialContent;
            return newMsgs;
          });
          lastFlushTime = nowTime;
        }
      }

      // Final
      setMessages((prev) => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1].content = partialContent;
        return newMsgs;
      });

      // Save final
      const botNow = new Date();
      const botMsgId = await db.chatMessages.add({
        chatId,
        sender: "bot",
        content: partialContent,
        createdAt: botNow,
        updatedAt: botNow,
      });
      setMessages((prev) => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = {
          id: botMsgId,
          sender: "bot",
          content: partialContent,
          createdAt: botNow,
          pending: false,
        };
        return newMsgs;
      });

      await db.chats.update(chatId, { updatedAt: botNow });
    } catch (err) {
      console.error("❌ Error editing message:", err);
    }
  }

  function isPlaceholderName(name: string) {
    const test = name.trim().toLowerCase();
    return test === "new chat" || test === "home chat";
  }

  if (!session?.user?.email) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Please sign in.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingDots size="large" className="text-muted-foreground" />
      </div>
    );
  }

  if (!chatExists) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">No such chat found.</p>
      </div>
    );
  }

  // === Layout ===
  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* 
        This ScrollArea is the entire vertical region, minus the input at bottom.
        So the scrollbar will appear on the far right.
      */}
      <ScrollArea className="flex-1 w-full">
        {/* 
          Your main chat content can be centered via max-w-3xl, 
          but the scrollbar stays at the container's right edge.
        */}
        <div className="relative mx-auto max-w-3xl w-full min-w-0 px-4 pt-8">
          {messages.length > 0 ? (
            messages.map((msg) => (
              <ChatMessageItem
                key={msg.id || msg.tempId}
                message={msg}
                isEditing={editingMessageId === msg.id}
                editInput={editInput}
                onChangeEditInput={setEditInput}
                onStartEditing={(id) => {
                  setEditingMessageId(id);
                  setEditInput(msg.content);
                }}
                onCancelEditing={() => {
                  setEditingMessageId(null);
                  setEditInput("");
                }}
                onSubmitEdit={handleEditSubmit}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          )}

          {/* Marker div for auto-scroll */}
          <div ref={endOfMessagesRef} />
        </div>
      </ScrollArea>

      {/* Sticky input row at bottom */}
      <div className="sticky bottom-0 left-0 right-0 bg-background-main z-50">
        {/* Put the input + model select in the same container width */}
        <div className="relative max-w-3xl mx-auto w-full px-4">
          <div className="absolute right-8 flex items-center z-10">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-8 px-3 text-xs shadow-none border-none rounded-lg hover:scale-105 focus:ring-0 focus-visible:ring-0 [&>span]:gap-3">
                <SelectValue
                  className="text-right text-muted-foreground pr-4"
                  placeholder="Model"
                />
              </SelectTrigger>
              <SelectContent className="min-w-[100px] border border-input/20 bg-background/95 backdrop-blur-sm shadow-lg">
                <SelectItem value="o3-mini-low" className="text-xs">
                  o3-mini (Low)
                </SelectItem>
                <SelectItem value="o3-mini-high" className="text-xs">
                  o3-mini (High)
                </SelectItem>
                <SelectItem value="o1" className="text-xs">
                  o1
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
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
            className="resize-none min-h-[120px] max-h-[200px] rounded-t-xl w-full px-4 pt-6 pb-4"
          />
        </div>
      </div>
    </div>
  );
}
