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
import { ScrollArea } from "@/components/ui/scroll-area"; // <-- Import the shadcn scroll-area
import { EphemeralMessage } from "./types";
import { ChatMessageItem } from "./ChatMessageItem";

interface Props {
  initialChatId: number; 
  defaultChatName?: string;
}

/**
 * Main chat component: loads messages from Dexie, streams replies, 
 * allows editing user messages, and auto-scrolls during streaming.
 */
export default function ChatInterface({
  initialChatId,
  defaultChatName = "New Chat",
}: Props) {
  const { data: session } = useSession();
  const { setCurrentChatId } = useSidebar();

  // We use this ref to auto-scroll to the bottom.
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [chatId] = useState<number>(initialChatId); // fixed
  const [messages, setMessages] = useState<EphemeralMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");

  // For editing existing user messages
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");

  // Default to "o3-mini-high" for normal conversation
  const [selectedModel, setSelectedModel] = useState("o3-mini-high");

  // Check DB for the chat record
  const [chatExists, setChatExists] = useState(true);
  const [chatName, setChatName] = useState(defaultChatName);

  /**
   * Auto-scroll to the bottom whenever `messages` changes.
   */
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * On mount, load the chat and its messages from Dexie.
   */
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

  /**
   * Convert ephemeral messages to { role, content } objects for the API.
   */
  function mapToApiMessages(msgs: EphemeralMessage[]) {
    return msgs.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.content,
    }));
  }

  /**
   * If the user’s first message has just gotten its bot reply, generate a short title.
   */
  async function generateTitleInBackground(userMsg: string, botMsg: string) {
    try {
      const titleRes = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: userMsg + "\n\n" + botMsg }),
      });

      if (!titleRes.ok) {
        const errorText = await titleRes.text();
        console.error("❌ Title API error response:", errorText);
        return;
      }

      const shortTitle = await titleRes.text();
      // Update Dexie
      await db.chats.update(chatId, {
        name: shortTitle,
        updatedAt: new Date(),
      });
      // Notify sidebar
      window.dispatchEvent(new Event("chat-updated"));
    } catch (error) {
      console.error("❌ Failed to generate chat title:", error);
    }
  }

  /**
   * Send the user’s message, then stream the bot’s reply.
   */
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

    // Show a pending bot message
    const tempId = `pending-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { tempId, sender: "bot", content: "", createdAt: now, pending: true },
    ]);

    try {
      // Build the conversation payload
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
        // remove pending
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      // Stream the bot’s reply
      let lastFlushTime = Date.now();
      let partialContent = "";
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        partialContent += chunk;

        // Throttle UI updates
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

      // Save final bot message
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

      // Update the chat’s `updatedAt`
      await db.chats.update(chatId, { updatedAt: botNow });

      // If this was the first user–bot exchange, generate a title
      if (messages.length === 0 && isPlaceholderName(chatName)) {
        generateTitleInBackground(content, partialContent);
      }
    } catch (err) {
      console.error("❌ Error streaming bot reply:", err);
      // remove pending
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      textareaRef.current?.focus();
    }
  }

  /**
   * Editing flow: remove subsequent messages, re-send from the updated user message.
   */
  async function handleEditSubmit(messageId: number) {
    if (!editInput.trim()) return;
    const now = new Date();

    try {
      // Update Dexie
      await db.chatMessages.update(messageId, {
        content: editInput,
        updatedAt: now,
      });

      // Replace in local state, slice off subsequent messages
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;
      const messagesBeforeEdit = messages.slice(0, idx + 1).map((m) =>
        m.id === messageId ? { ...m, content: editInput } : m
      );
      setMessages(messagesBeforeEdit);

      setEditingMessageId(null);
      setEditInput("");

      // Remove subsequent from DB
      const subsequent = await db.chatMessages
        .where("chatId")
        .equals(chatId)
        .filter((msg) => msg.id! > messageId)
        .toArray();
      await Promise.all(subsequent.map((msg) => db.chatMessages.delete(msg.id!)));

      // Insert new pending
      const tempId = `pending-edit-${Date.now()}`;
      setMessages([
        ...messagesBeforeEdit,
        { tempId, sender: "bot", content: "", createdAt: new Date(), pending: true },
      ]);

      // Re-send conversation
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

      // Stream new bot reply
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

      // Final flush
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

  /**
   * Check if name looks like a placeholder (i.e., "New Chat").
   */
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

  // Otherwise, valid chat
  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden">
      <div className="relative flex flex-col h-full max-w-3xl mx-auto w-full">
        {/* Messages in a scrollable area */}
        <ScrollArea className="flex-1 px-4 pt-8">
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
                onSubmitEdit={(id) => handleEditSubmit(id)}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No messages yet.
            </p>
          )}

          {/* An invisible marker to scroll into view */}
          <div ref={endOfMessagesRef} />
        </ScrollArea>

        {/* Input area at the bottom */}
        <div className="sticky bottom-0 left-0 right-0 bg-background-main z-50">
          <div className="relative px-4">
            <div className="absolute right-8 flex items-center z-10">
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="h-8 px-3 text-xs shadow-none hover:text-primary border-none rounded-lg hover:scale-105 focus:ring-0 focus-visible:ring-0 [&>span]:gap-3">
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
              ref={textareaRef}
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
    </div>
  );
}
