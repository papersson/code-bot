"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSidebar } from "@/hooks/useSidebar";
import { db } from "@/db/dexie";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { PencilIcon, CopyIcon, CheckIcon } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CodeBlock } from "@/components/CodeBlock";

interface EphemeralMessage {
  id?: number;
  tempId?: string;
  sender: "user" | "bot";
  content: string;
  createdAt: Date;
  pending?: boolean;
}

interface Props {
  initialChatId: number | null;
  defaultChatName?: string;
}

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

  // Default to "o3-mini" because "o1" can't stream
  const [selectedModel, setSelectedModel] = useState("o3-mini");

  // For editing existing user messages
  const [editingMessageId, setEditingMessageId] = useState<number | string | null>(null);
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

  // Show spinner if loading old messages
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  // Convert ephemeral messages to { role, content }
  function mapToApiMessages(msgs: EphemeralMessage[]) {
    return msgs.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.content,
    }));
  }

  /**
   * SEND LOGIC
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

      // Throttling setup
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

        // Throttle UI updates to reduce flicker
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
      // We'll only focus once after sending, not every chunk
      textareaRef.current?.focus();
    }
  }

  /**
   * Renders the message. If pending & no content => spinner
   */
  function MessageContent({
    content,
    pending,
    sender,
  }: {
    content: string;
    pending?: boolean;
    sender: "user" | "bot";
  }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    // If still waiting for the first chunk
    if (pending && !content) {
      return (
        <div className="flex items-center gap-2">
          <Spinner size={16} className="text-muted-foreground" />
          <span className="text-muted-foreground">Thinking...</span>
        </div>
      );
    }

    // If partial text is present & still pending, show text + spinner
    if (pending && content) {
      return (
        <div>
          <div className="mb-1 text-sm text-muted-foreground flex items-center gap-2">
            <Spinner size={16} />
            <span>Generating partial response...</span>
          </div>
          <MarkdownContent text={content} />
        </div>
      );
    }

    // For user messages, render as raw text
    if (sender === "user") {
      return <div className="whitespace-pre-wrap">{content}</div>;
    }

    // For bot messages, render as markdown with copy button
    return (
      <div className="relative">
        <div className="prose prose-sm dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          <div className="max-w-full">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                pre: ({ children }) => (
                  <div className="relative max-w-full">{children}</div>
                ),
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const language = match ? match[1] : undefined;
                  const isInline = !match;
                  const code = String(children).replace(/\n$/, "");

                  if (isInline) {
                    return (
                      <code
                        className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md text-sm font-mono border border-zinc-200 dark:border-zinc-700"
                        style={{
                          fontFamily: "var(--font-jetbrains-mono), monospace",
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }

                  return (
                    <CodeBlock value={code} language={language} className="my-4" />
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md flex items-center gap-1 text-xs text-zinc-500"
          >
            {copied ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
            <span>{copied ? "Copied!" : "Copy Response"}</span>
          </button>
        </div>
      </div>
    );
  }

  /**
   * A sub-component for rendering text as Markdown.
   */
  function MarkdownContent({ text }: { text: string }) {
    return (
      <div className="relative">
        <div className="prose prose-sm dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          <div className="max-w-full">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                pre: ({ children }) => (
                  <div className="relative max-w-full overflow-x-auto">
                    {children}
                  </div>
                ),
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const language = match ? match[1] : undefined;
                  const isInline = !match;
                  const code = String(children).replace(/\n$/, "");

                  if (isInline) {
                    return (
                      <code
                        className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md text-sm font-mono border border-zinc-200 dark:border-zinc-700"
                        style={{
                          fontFamily: "var(--font-jetbrains-mono), monospace",
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }

                  return (
                    <CodeBlock
                      value={code}
                      language={language}
                      className="my-4"
                    />
                  );
                },
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Edit logic: re-send from that message onwards, same throttle approach
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

      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;

      // Keep up to the edited message
      const messagesBeforeEdit = messages.slice(0, idx + 1).map((m) =>
        m.id === messageId ? { ...m, content: editInput } : m
      );
      setMessages(messagesBeforeEdit);
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
      const allMessages = [
        ...messages,
        { sender: "user" as const, content, createdAt: now },
      ];
      const body = {
        messages: mapToApiMessages(allMessages),
        model: selectedModel,
      };

      // Re-send to /api/chat
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

      // Store final in Dexie
      const botNow = new Date();
      const botMsgId = await db.chatMessages.add({
        chatId: chatId,
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

  return (
    <div className="flex flex-col h-full min-w-0 overflow-y-auto">
      <div className="relative flex flex-col min-h-full max-w-3xl mx-auto w-full min-w-0">
        <div className="flex-1 min-w-0">
          <div className="pt-8 pb-[120px] px-4 min-w-0">
            {messages.length > 0 ? (
              messages.map((msg) => (
                <div
                  key={msg.id || msg.tempId}
                  className={cn(
                    "mb-6 group relative flex items-start justify-between gap-2 min-w-0",
                    msg.sender === "bot"
                      ? "bg-background-main rounded-lg p-4 [&_.code-block-container]:!overflow-visible"
                      : editingMessageId === msg.id
                      ? "bg-background-main dark:bg-zinc-800 p-4"
                      : "bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700 dark:text-zinc-100 rounded-xl p-4"
                  )}
                >
                  {/* Also `min-w-0` for the flex child: */}
                  <div className="flex-1 min-w-0 [&_.code-block-container]:relative [&_.code-block-container]:!overflow-visible">
                    {editingMessageId === msg.id ? (
                      <div className="flex flex-col gap-4">
                        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                          <Textarea
                            value={editInput}
                            onChange={(e) => setEditInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleEditSubmit(msg.id!);
                              }
                              if (e.key === "Escape") {
                                setEditingMessageId(null);
                                setEditInput("");
                              }
                            }}
                            className="resize-none min-h-[90px] max-h-[200px] w-full bg-white focus:outline-none focus:ring-0 p-3 text-sm rounded-xl"
                            autoFocus
                            placeholder="Edit your message..."
                          />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => {
                              setEditingMessageId(null);
                              setEditInput("");
                            }}
                            className="px-4 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-full transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleEditSubmit(msg.id!)}
                            className="px-4 py-1.5 text-xs font-medium text-white bg-button hover:bg-button-hover rounded-full transition-colors"
                          >
                            Save changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <MessageContent
                        content={msg.content}
                        pending={msg.pending}
                        sender={msg.sender}
                      />
                    )}
                  </div>

                  {/* Edit button for user messages */}
                  {msg.sender === "user" && msg.id && !editingMessageId && (
                    <button
                      onClick={() => {
                        setEditingMessageId(msg.id!);
                        setEditInput(msg.content);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 text-zinc-400 hover:text-zinc-500 dark:text-zinc-500 dark:hover:text-zinc-400"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                Start the conversation by typing a message below.
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="sticky bottom-0 left-0 right-0 bg-background-main z-10">
          <div className="relative px-4">
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
              className="resize-none min-h-[90px] max-h-[200px] rounded-t-xl w-full p-4 pb-12"
            />
            <div className="absolute bottom-2 right-3">
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="h-7 w-[100px] border-none shadow-none text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                  <SelectValue className="text-right" placeholder="Model" />
                </SelectTrigger>
                <SelectContent className="border border-input/20 bg-background/95 shadow-md overflow-hidden">
                  <SelectItem value="o3-mini" className="text-xs text-right">
                    o3-mini
                  </SelectItem>
                  <SelectItem value="o1" className="text-xs text-right">
                    o1
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
