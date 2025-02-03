"use client";

import React from "react";
import { PencilIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { EphemeralMessage } from "./types";
import { MessageContent } from "./MessageContent";

interface ChatMessageItemProps {
  message: EphemeralMessage;
  isEditing: boolean;
  editInput: string;
  onChangeEditInput: (value: string) => void;
  onStartEditing: (messageId: number) => void;
  onCancelEditing: () => void;
  onSubmitEdit: (messageId: number) => void;
}

/**
 * Renders a single message (user or bot), plus optional edit UI for user messages.
 */
export function ChatMessageItem({
  message,
  isEditing,
  editInput,
  onChangeEditInput,
  onStartEditing,
  onCancelEditing,
  onSubmitEdit,
}: ChatMessageItemProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (message.id) {
        onSubmitEdit(message.id);
      }
    }
    if (e.key === "Escape") {
      onCancelEditing();
    }
  };

  return (
    <div
      key={message.id || message.tempId}
      className={cn(
        "mb-6 group relative flex items-start justify-between gap-2 min-w-0",
        message.sender === "bot"
          ? "bg-background-main rounded-lg p-4 [&_.code-block-container]:!overflow-visible"
          : isEditing
          ? "bg-background-main dark:bg-zinc-800 p-4"
          : "bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700 dark:text-zinc-100 rounded-xl p-4"
      )}
    >
      <div className="flex-1 min-w-0 [&_.code-block-container]:relative [&_.code-block-container]:!overflow-visible">
        {/* If editing and it's the user message, show textarea */}
        {isEditing ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <Textarea
                value={editInput}
                onChange={(e) => onChangeEditInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="resize-none min-h-[90px] max-h-[200px] w-full bg-white focus:outline-none focus:ring-0 p-3 text-sm rounded-xl"
                autoFocus
                placeholder="Edit your message..."
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => onCancelEditing()}
                className="px-4 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-full transition-colors"
              >
                Cancel
              </button>
              {message.id && (
                <button
                  onClick={() => onSubmitEdit(message.id!)}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-button hover:bg-button-hover rounded-full transition-colors"
                >
                  Save changes
                </button>
              )}
            </div>
          </div>
        ) : (
          <MessageContent
            content={message.content}
            pending={message.pending}
            sender={message.sender}
          />
        )}
      </div>

      {/* Show edit button if it's a user message and not editing */}
      {message.sender === "user" && message.id && !isEditing && (
        <button
          onClick={() => onStartEditing(message.id!)}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 text-zinc-400 hover:text-zinc-500 dark:text-zinc-500 dark:hover:text-zinc-400"
        >
          <PencilIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
