"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

interface MarkdownContentProps {
  text: string;
}

/**
 * A sub-component for rendering text as Markdown.
 */
export function MarkdownContent({ text }: MarkdownContentProps) {
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
