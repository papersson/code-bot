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

  // Default to "o3-mini-high" for normal conversation
  const [selectedModel, setSelectedModel] = useState("o3-mini-high");

  // For editing existing user messages
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");

  // Focus the textarea once if ephemeral
  useEffect(() => {
    if (initialChatId === null) {
      textareaRef.current?.focus();
    }
  }, [initialChatId]);

  // Load messages from Dexie if we have a numeric chatId
  useEffect(() => {
    if (!session?.user?.email) return;
    if (chatId === null) return; // ephemeral => skip DB load
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

  // Helper: Convert ephemeral messages to { role, content } for the API body
  function mapToApiMessages(msgs: EphemeralMessage[]) {
    return msgs.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.content,
    }));
  }

  /**
   * Non-blocking background function to generate and set a new title
   * for the chat, then dispatch "chat-updated".
   */
  async function generateTitleInBackground(
    chatIdForTitle: number,
    userMessage: string,
    botMessage: string
  ) {
    try {
      const titleRes = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: userMessage + "\n\n" + botMessage }),
      });

      if (!titleRes.ok) {
        const errorText = await titleRes.text();
        console.error("❌ Title API error response:", errorText);
        return;
      }

      const shortTitle = await titleRes.text();
      await db.chats.update(chatIdForTitle, {
        name: shortTitle,
        updatedAt: new Date(),
      });
      // Notify sidebar that the chat name changed
      window.dispatchEvent(new Event("chat-updated"));
    } catch (error) {
      console.error("❌ Failed to generate chat title:", error);
    }
  }

  /**
   * Called when user hits Enter (without Shift) or clicks Send.
   * Streams the bot's reply, then *after* the first user–bot exchange
   * is complete, we do a background call to the title API if needed.
   */
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
        name: defaultChatName, // e.g., "New Chat" or "Home Chat"
        createdAt: now,
        updatedAt: now,
      });
      setChatId(currentChatId);
      setCurrentChatId(currentChatId);
      window.dispatchEvent(new Event("chat-created"));
    }

    const chatIdForMessages = currentChatId as number;

    // Save user message to Dexie
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

    // Create one pending bot message
    const tempId = `pending-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { tempId, sender: "bot", content: "", createdAt: new Date(), pending: true },
    ]);

    try {
      // Combine all prior messages + new user message for the LLM prompt
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
        // remove the pending bot message
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      // Stream text
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

      // Final UI update
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

      // If this is the FIRST user–bot exchange (i.e., 2 total messages so far),
      // and the chat name is still a default placeholder, let's do a background
      // title generation using both user + bot content.
      if (messages.length === 0) {
        // Now we have exactly 2 messages: [userMsg, botMsg]
        // Double-check the chat’s current name from Dexie
        const chatRecord = await db.chats.get(chatIdForMessages);
        if (chatRecord && chatRecord.name && isDefaultPlaceholder(chatRecord.name)) {
          // Do NOT await to keep it non-blocking
          generateTitleInBackground(chatIdForMessages, content, partialContent);
        }
      }
    } catch (err) {
      console.error("❌ Error streaming bot reply:", err);
      // remove the pending bot message
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      textareaRef.current?.focus();
    }
  }

  /**
   * Decide if a chat name is just a placeholder (like "New Chat" or "Home Chat")
   */
  function isDefaultPlaceholder(name: string) {
    return (
      name.trim().toLowerCase() === "new chat" ||
      name.trim().toLowerCase() === "home chat"
    );
  }

  /**
   * Called when user finishes editing a message in the conversation.
   * After saving, we remove all subsequent messages and re-send to the AI.
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

      // Re-send the conversation
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
        // remove the pending
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      // Stream
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

      // Save final bot message
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

        await db.chats.update(chatId, { updatedAt: botNow });
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
          <div className="pt-8 px-4 min-w-0">
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
              className="resize-none min-h-[120px] max-h-[200px] rounded-t-xl w-full px-4 pt-4 pb-4"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
