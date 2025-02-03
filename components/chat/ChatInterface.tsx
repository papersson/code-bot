"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSidebar } from "@/hooks/useSidebar";
import { db } from "@/db/dexie";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EphemeralMessage } from "./types";
import { ChatMessageItem } from "./ChatMessageItem";

interface Props {
  initialChatId: number | null;
  defaultChatName?: string;
}

/**
 * Main chat component: loads messages from Dexie, streams AI responses,
 * and handles user input, editing, etc.
 */
export default function ChatInterface({
  initialChatId,
  defaultChatName = "New Chat",
}: Props) {
  const { data: session } = useSession();
  const { setCurrentChatId } = useSidebar();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [chatId, setChatId] = useState<number | null>(initialChatId);
  const [messages, setMessages] = useState<EphemeralMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");

  // Default to "o3-mini" because "o1" can't stream in this code
  const [selectedModel, setSelectedModel] = useState("o3-mini");

  // For editing existing user messages
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");

  // Focus the textarea once if ephemeral
  useEffect(() => {
    if (initialChatId === null) {
      textareaRef.current?.focus();
    }
  }, [initialChatId]);

  // If numeric chatId, load messages from Dexie
  useEffect(() => {
    if (!session?.user?.email) return;
    if (chatId === null) return; // ephemeral => skip
    setLoading(true);

    (async () => {
      const existingChat = await db.chats.get(chatId!);
      if (!existingChat) {
        setMessages([]);
        setLoading(false);
        return;
      }

      setCurrentChatId(chatId!);

      const stored = await db.chatMessages
        .where("chatId")
        .equals(chatId!)
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
  }, [chatId, session, setCurrentChatId]);

  // Convert ephemeral messages to { role, content } for the API body
  function mapToApiMessages(msgs: EphemeralMessage[]) {
    return msgs.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.content,
    }));
  }

  async function handleSend() {
    const content = input.trim();
    if (!content) return;
    setInput("");

    // If ephemeral => create Dexie chat
    let currentChatId = chatId;
    const now = new Date();
    if (currentChatId === null) {
      currentChatId = await db.chats.add({
        userId: session!.user!.email!,
        name: defaultChatName,
        createdAt: now,
        updatedAt: now,
      });
      setChatId(currentChatId);
      setCurrentChatId(currentChatId);
      window.dispatchEvent(new Event("chat-created"));
    }
    const chatIdForMessages = currentChatId as number;

    // Save user message
    const userMsgId = await db.chatMessages.add({
      chatId: chatIdForMessages,
      sender: "user",
      content,
      createdAt: now,
      updatedAt: now,
    });
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: "user", content, createdAt: now },
    ]);

    // Create one pending bot message (stable tempId)
    const tempId = `pending-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { tempId, sender: "bot", content: "", createdAt: new Date(), pending: true },
    ]);

    try {
      // Combine all previous messages + new user message
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
        // Remove the pending
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      // Throttle interval
      const flushInterval = 50; // ms
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
        if (nowTime - lastFlushTime >= flushInterval) {
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

      // Final update after the stream ends
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
        chatId: chatIdForMessages,
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

      await db.chats.update(chatIdForMessages, { updatedAt: botNow });
    } catch (err) {
      console.error("❌ Error streaming bot reply:", err);
      setMessages((prev) => prev.slice(0, -1)); // remove pending
    } finally {
      textareaRef.current?.focus();
    }
  }

  /**
   * Edit logic: re-send from that message onwards
   */
  async function handleEditSubmit(messageId: number) {
    if (!editInput.trim()) return;
    const now = new Date();

    try {
      // Update Dexie with new text
      await db.chatMessages.update(messageId, {
        content: editInput,
        updatedAt: now,
      });

      // Replace the content in our local state for that message
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;
      const messagesBeforeEdit = messages.slice(0, idx + 1).map((m) =>
        m.id === messageId ? { ...m, content: editInput } : m
      );
      setMessages(messagesBeforeEdit);

      // Turn off editing
      setEditingMessageId(null);
      setEditInput("");

      // Remove subsequent messages from Dexie
      if (chatId) {
        const subsequent = await db.chatMessages
          .where("chatId")
          .equals(chatId)
          .filter((msg) => msg.id! > messageId)
          .toArray();
        await Promise.all(
          subsequent.map((msg) => db.chatMessages.delete(msg.id!))
        );
      }

      // Insert new pending bot message
      const tempId = `pending-edit-${Date.now()}`;
      setMessages((prev) => [
        ...messagesBeforeEdit,
        { tempId, sender: "bot", content: "", createdAt: new Date(), pending: true },
      ]);

      // Re-send to /api/chat with updated conversation
      const allMessages = messagesBeforeEdit;
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
        console.error("❌ Stream error (edit):", response.status);
        setMessages((prev) => prev.slice(0, -1)); // remove pending
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

        // Throttle
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

      // Final update
      setMessages((prev) => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1].content = partialContent;
        return newMsgs;
      });

      // Store final bot message
      if (chatId) {
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

        await db.chats.update(chatId, { updatedAt: now });
      }
    } catch (err) {
      console.error("❌ Error editing message:", err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-w-0 overflow-y-auto">
      <div className="relative flex flex-col min-h-full max-w-3xl mx-auto w-full min-w-0">
        <div className="flex-1 min-w-0">
          <div className="pt-8 pb-[120px] px-4 min-w-0">
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
              <div className="text-sm text-muted-foreground">
                Start the conversation by typing a message below.
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="sticky bottom-0 left-0 right-0 bg-background-main z-50">
          <div className="relative px-4">
            <div className="absolute right-8 top-2 flex items-center z-10">
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="h-8 px-3 text-xs shadow-none hover:text-primary border-none rounded-lg hover:scale-105 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:outline-none [&>span]:gap-3">
                  <SelectValue className="text-right text-muted-foreground pr-4" placeholder="Model" />
                </SelectTrigger>
                <SelectContent className="min-w-[100px] border border-input/20 bg-background/95 backdrop-blur-sm shadow-lg">
                  <SelectItem value="o3-mini" className="text-xs">
                    o3-mini
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
              className="resize-none min-h-[90px] max-h-[200px] rounded-t-xl w-full px-4 pt-12 pb-4"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
