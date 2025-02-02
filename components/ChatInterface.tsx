"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSidebar } from "@/hooks/useSidebar";
import { db } from "@/db/dexie";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { PencilIcon } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CodeBlock } from "@/components/CodeBlock";

// Import the Azure provider and generateText from the AI SDK
import { createAzure } from "@ai-sdk/azure";
import { generateText } from "ai";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // We'll store the "real" chatId if/when we create or load from Dexie.
  // If initialChatId is a valid number, we do "persisted mode" right away.
  // If it's null, we start ephemeral and only become "persisted" if we
  // actually create a new chat on first send.
  const [chatId, setChatId] = useState<number | null>(initialChatId);

  // For ephemeral usage: we store messages in memory
  // until we either convert to Dexie or we are already in Dexie mode.
  interface EphemeralMessage {
    id?: number;
    tempId?: string;  // Add this field for temporary IDs
    sender: "user" | "bot";
    content: string;
    createdAt: Date;
  }

  // Add a pending message type to show loading state
  interface PendingMessage extends EphemeralMessage {
    pending?: boolean;
  }

  const [messages, setMessages] = useState<PendingMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");

  // Model picker state
  const [selectedModel, setSelectedModel] = useState("o1");

  // Editing state
  const [editingMessageId, setEditingMessageId] = useState<number | string | null>(null);
  const [editInput, setEditInput] = useState("");

  // Focus textarea on mount and updates for new chats
  useEffect(() => {
    if (initialChatId === null) {
      // Try immediate focus
      textareaRef.current?.focus();

      // Also try with a small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [initialChatId]);

  // Additional focus when messages change (for both new chats and responses)
  useEffect(() => {
    textareaRef.current?.focus();
  }, [messages]);

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
      const ephemeral: EphemeralMessage[] = storedMessages.map((m) => ({
        id: m.id,
        sender: m.sender as "bot" | "user",
        content: m.content,
        createdAt: m.createdAt || new Date(),
      }));
      setMessages(ephemeral.map((m) => ({ ...m, pending: false })));
      setLoading(false);
    })();
  }, [chatId, session, setCurrentChatId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  // MAIN SEND LOGIC
  async function handleSend() {
    const content = input.trim();
    if (!content) return;
    setInput("");

    let currentChatId = chatId;
    const now = new Date();

    if (currentChatId === null) {
      // FIRST TIME: create a brand-new Dexie chat
      console.log('📝 Creating new chat in Dexie');
      currentChatId = await db.chats.add({
        userId: session!.user!.email!,
        name: defaultChatName,
        createdAt: now,
        updatedAt: now,
      });
      console.log('✅ Created new chat with ID:', currentChatId);
      setChatId(currentChatId);
      setCurrentChatId(currentChatId);

      // Focus textarea after creating new chat
      textareaRef.current?.focus();

      // Dispatch so the sidebar updates immediately
      window.dispatchEvent(new Event("chat-created"));
    }

    // At this point, currentChatId is guaranteed to be a number
    const chatIdForMessages = currentChatId as number;

    // Insert the user message in Dexie
    console.log('📤 Saving user message to Dexie');
    const msgId = await db.chatMessages.add({
      chatId: chatIdForMessages,
      sender: "user",
      content,
      createdAt: now,
      updatedAt: now,
    });
    console.log('✅ Saved user message with ID:', msgId);

    // Update the chat's updatedAt timestamp
    await db.chats.update(chatIdForMessages, { updatedAt: now });

    // Also reflect it in ephemeral local state
    setMessages((prev) => [
      ...prev,
      { id: msgId, sender: "user", content, createdAt: now, pending: false },
    ]);

    // Add pending bot message with a temporary ID
    const tempId = `pending-${Date.now()}`;
    console.log('⏳ Adding pending bot message with tempId:', tempId);
    setMessages((prev) => [
      ...prev,
      {
        sender: "bot",
        content: "",
        createdAt: new Date(),
        pending: true,
        tempId
      },
    ]);

    // Generate bot reply using Azure AI SDK
    try {
      console.log('🤖 Generating bot reply using model:', selectedModel);
      const azure = createAzure({
        resourceName: process.env.NEXT_PUBLIC_AZURE_RESOURCE_NAME,
        apiKey: process.env.NEXT_PUBLIC_AZURE_API_KEY,
        apiVersion: "2024-12-01-preview",
      });
      const modelInstance = azure(selectedModel);
      const { text: botText, usage } = await generateText({
        model: modelInstance,
        prompt: content,
      });
      console.log('✨ Received bot response with usage:', usage);
      
      const botNow = new Date();
      console.log('💾 Saving bot response to Dexie');
      const botMsgId = await db.chatMessages.add({
        chatId: chatIdForMessages,
        sender: "bot",
        content: botText,
        createdAt: botNow,
        updatedAt: botNow,
      });
      console.log('✅ Saved bot message with ID:', botMsgId);
      
      // Replace pending message with actual response
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { id: botMsgId, sender: "bot", content: botText, createdAt: botNow },
      ]);
      
      await db.chats.update(chatIdForMessages, { updatedAt: botNow });
    } catch (error) {
      console.error('❌ Error generating bot reply:', error);
      // Remove pending message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      textareaRef.current?.focus();
    }
  }

  // Add this new component for message rendering
  function MessageContent({ content, pending }: { content: string; pending?: boolean }) {
    if (pending) {
      return (
        <div className="flex items-center gap-2">
          <Spinner size={16} className="text-muted-foreground" />
          <span className="text-muted-foreground">Thinking...</span>
        </div>
      );
    }

    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            pre: ({ node, ...props }) => (
              <div className="relative">
                {props.children}
              </div>
            ),
            code({ node, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : undefined;
              const isInline = !match;
              const code = String(children).replace(/\n$/, '');

              if (isInline) {
                return (
                  <code className="bg-muted px-1.5 py-0.5 rounded-md text-sm" {...props}>
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
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  // Add function to handle message edit
  const handleEditSubmit = async (messageId: number) => {
    if (!editInput.trim()) return;
    
    try {
      // Update the message in the database
      await db.chatMessages.update(messageId, {
        content: editInput,
        updatedAt: new Date(),
      });
      
      // Find the index of the edited message
      const editedMessageIndex = messages.findIndex(msg => msg.id === messageId);
      if (editedMessageIndex === -1) return;

      // Remove all messages after the edited message
      const messagesBeforeEdit = messages.slice(0, editedMessageIndex + 1);
      
      // Update the messages state with only messages up to the edited one
      setMessages(messagesBeforeEdit.map(msg => 
        msg.id === messageId ? { ...msg, content: editInput } : msg
      ));
      
      // Reset editing state
      setEditingMessageId(null);
      setEditInput("");

      // Add pending bot message
      const now = new Date();
      setMessages(prev => [...prev, {
        sender: "bot",
        content: "",
        createdAt: now,
        pending: true,
        tempId: `pending-${Date.now()}`
      }]);

      // Delete subsequent messages from the database
      if (chatId) {
        const subsequentMessages = await db.chatMessages
          .where('chatId')
          .equals(chatId)
          .filter(msg => msg.id! > messageId)
          .toArray();
        
        await Promise.all(subsequentMessages.map(msg => 
          db.chatMessages.delete(msg.id!)
        ));
      }

      // Generate new bot reply
      try {
        const azure = createAzure({
          resourceName: process.env.NEXT_PUBLIC_AZURE_RESOURCE_NAME,
          apiKey: process.env.NEXT_PUBLIC_AZURE_API_KEY,
          apiVersion: "2024-12-01-preview",
        });
        const modelInstance = azure(selectedModel);
        const { text: botText, usage } = await generateText({
          model: modelInstance,
          prompt: editInput,
        });
        const botNow = new Date();
        
        if (chatId) {
          const botMsgId = await db.chatMessages.add({
            chatId: chatId,
            sender: "bot",
            content: botText,
            createdAt: botNow,
            updatedAt: botNow,
          });
          
          // Replace pending message with actual response
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { id: botMsgId, sender: "bot", content: botText, createdAt: botNow },
          ]);
          
          await db.chats.update(chatId, { updatedAt: botNow });
        }
      } catch (error) {
        // Remove pending message on error
        setMessages((prev) => prev.slice(0, -1));
        console.error("Error generating bot reply:", error);
      }
    } catch (error) {
      console.error("Error updating message:", error);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="relative flex flex-col min-h-full max-w-3xl mx-auto w-full">
        {/* MESSAGES */}
        <div className="flex-1 px-4">
          <div className="pt-8 pb-[120px]">
            {messages.length > 0 ? (
              messages.map((msg) => (
                <div
                  key={msg.id || msg.tempId}
                  className={cn(
                    "mb-6 px-4 py-3 rounded-lg group relative",
                    msg.sender === "bot" 
                      ? "bg-background-main" 
                      : "rounded-xl bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700 dark:text-zinc-100"
                  )}
                >
                  {msg.sender === "user" && msg.id && (
                    <button
                      onClick={() => {
                        setEditingMessageId(msg.id!);
                        setEditInput(msg.content);
                      }}
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                    >
                      <PencilIcon className="h-4 w-4 text-zinc-500" />
                    </button>
                  )}
                  
                  {editingMessageId === msg.id ? (
                    <div className="flex flex-col gap-2">
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
                        className="resize-none min-h-[90px] max-h-[200px] w-full p-2"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setEditingMessageId(null);
                            setEditInput("");
                          }}
                          className="px-3 py-1 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleEditSubmit(msg.id!)}
                          className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <MessageContent content={msg.content} pending={msg.pending} />
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

        {/* INPUT AREA */}
        <div className="sticky bottom-0 left-0 right-0 bg-background-main px-4 z-10">
          <div className="relative">
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
                <SelectTrigger className="h-7 w-[100px] border-none shadow-none text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:ring-0 focus:ring-offset-0 focus:border-none focus:outline-none flex justify-end">
                  <SelectValue className="text-right" placeholder="Select model" />
                </SelectTrigger>
                <SelectContent className="border border-input/20 bg-background/95 shadow-md overflow-hidden">
                  <SelectItem value="o1" className="text-xs text-right">o1</SelectItem>
                  <SelectItem value="o1-mini" className="text-xs text-right">o1-mini</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
