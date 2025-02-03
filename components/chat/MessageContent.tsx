"use client";

import React, { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { LoadingDots } from "@/components/ui/loading-dots";
import { MarkdownContent } from "./MarkdownContent";

interface MessageContentProps {
  content: string;
  pending?: boolean;
  sender: "user" | "bot";
}

/**
 * Handles how a single message's text is displayed, including
 * partial "pending" text or a copy button for bot responses.
 */
export function MessageContent({ content, pending, sender }: MessageContentProps) {
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
        <LoadingDots size="small" className="text-muted-foreground" />
        <span className="text-muted-foreground">Thinking...</span>
      </div>
    );
  }

  // If partial text is present & still pending, show text + spinner
  if (pending && content) {
    return (
      <div>
        <div className="mb-1 text-sm text-muted-foreground flex items-center gap-2">
          <LoadingDots size="small" />
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

  // For bot messages, render as markdown + copy button
  return (
    <div className="relative">
      <div className="prose prose-sm dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <div className="max-w-full">
          <MarkdownContent text={content} />
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
