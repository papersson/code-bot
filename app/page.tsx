"use client";

import ChatInterface from "@/components/ChatInterface";

/**
 * Home page: starts ephemeral (null chatId). 
 * The ChatInterface will create a Dexie chat record
 * only if the user actually sends a message.
 */
export default function Home() {
  return <ChatInterface initialChatId={null} defaultChatName="Home Chat" />;
}
