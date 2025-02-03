"use client";

import React from "react";
import { PencilIcon, UserCircle2 } from "lucide-react";
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
        "mb-6 group relative flex min-w-0",
        message.sender === "bot"
          ? "bg-background-main rounded-lg p-4 [&_.code-block-container]:!overflow-visible items-start justify-between gap-2"
          : isEditing
          ? "bg-background-main dark:bg-zinc-800 p-4 items-start justify-between gap-2"
          : "flex-row-reverse items-end justify-start gap-3 pr-2"
      )}
    >
      {message.sender === "user" && !isEditing && (
        <div className="flex flex-col items-end space-y-2 min-w-0 max-w-[85%]">
          <div className="flex items-center gap-2 -mr-8">
            <div className="bg-chat-user text-chat-user-foreground p-3.5  rounded-2xl shadow-[0_2px_8px_-4px_rgba(0,0,0,0.03)] border border-chat-user/5">
              <MessageContent
                content={message.content}
                pending={message.pending}
                sender={message.sender}
              />
            </div>
            <div className="bg-chat-user-background dark:bg-chat-user/10 rounded-full shadow-[0_1px_3px_-1px_rgba(0,0,0,0.02)] ring-1 ring-chat-user/5">
              <UserCircle2 className="w-4 h-4 text-chat-user dark:text-chat-user/80" />
            </div>
          </div>
        </div>
      )}
      
      {(message.sender === "bot" || isEditing) && (
        <div className="flex-1 min-w-0 [&_.code-block-container]:relative [&_.code-block-container]:!overflow-visible">
          {isEditing ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-input bg-background/50 shadow-sm backdrop-blur-[2px]">
                <Textarea
                  value={editInput}
                  onChange={(e) => onChangeEditInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="resize-none min-h-[90px] max-h-[200px] w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-chat-user/30 p-3 text-sm rounded-xl"
                  autoFocus
                  placeholder="Edit your message..."
                />
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => onCancelEditing()}
                  className="px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-full transition-colors"
                >
                  Cancel
                </button>
                {message.id && (
                  <button
                    onClick={() => onSubmitEdit(message.id!)}
                    className="px-4 py-1.5 text-xs font-medium text-chat-user-foreground bg-chat-user hover:bg-chat-user/90 rounded-full transition-colors shadow-sm"
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
      )}

      {/* Show edit button if it's a user message and not editing */}
      {message.sender === "user" && message.id && !isEditing && (
        <button
          onClick={() => onStartEditing(message.id!)}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 text-chat-user-icon/50 hover:text-chat-user-icon"
        >
          <PencilIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
