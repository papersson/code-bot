"use client";

import { useParams } from "next/navigation";
import ChatInterface from "@/components/chat/ChatInterface";

export default function ChatDetailPage() {
  const { chatId } = useParams() as { chatId: string };
  // parse or coerce to a number
  const numericId = Number(chatId);

  return <ChatInterface initialChatId={numericId} defaultChatName="New Chat" />;
}
