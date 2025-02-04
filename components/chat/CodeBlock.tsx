import React, { useState, useEffect } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import hljs from "highlight.js";
import "@/styles/gruvbox-dark.css";

interface CodeBlockProps {
  fileName?: string;
  language?: string;
  value: string;
  className?: string;
}

export function CodeBlock({ fileName, language, value, className }: CodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState("");
  const [displayFileName, setDisplayFileName] = useState<string | null>(fileName || null);

  useEffect(() => {
    if (!fileName) {
      const lines = value.split("\n");
      if (lines.length > 1) {
        setDisplayFileName(lines[0]);
        highlightCode(lines.slice(1).join("\n"));
      } else {
        highlightCode(value);
      }
    } else {
      highlightCode(value);
    }
  }, [fileName, language, value]);

  const highlightCode = (code: string) => {
    if (language) {
      try {
        // Try to get the language definition first
        if (hljs.getLanguage(language)) {
          const result = hljs.highlight(code, { language });
          setHighlightedCode(result.value);
        } else {
          // Language not supported, fallback to plaintext
          console.warn(`Language '${language}' not supported, falling back to plaintext`);
          const result = hljs.highlight(code, { language: 'plaintext' });
          setHighlightedCode(result.value);
        }
      } catch (error) {
        console.warn(`Failed to highlight code: ${error}`);
        setHighlightedCode(code);
      }
    } else {
      setHighlightedCode(code);
    }
  };

  const copyToClipboard = async () => {
    let codeToCopy = "";
    if (!fileName) {
      const lines = value.split("\n");
      codeToCopy = lines.length > 1 ? lines.slice(1).join("\n") : value;
    } else {
      codeToCopy = value;
    }
    await navigator.clipboard.writeText(codeToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      style={{
        maxWidth: "700px",
        overflowX: "auto",
      }}
      className={cn(
        "code-block-container relative group bg-[#282828] shadow-md rounded-xl",
        className
      )}
    >
      {/* Combined header with three Mac-like icons, file name, language, and copy icon */}
      <div className="sticky top-0 z-20 rounded-t-xl bg-[#282828] border-b border-[#3c3836] flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#cc241d]" />
            <div className="w-3 h-3 rounded-full bg-[#98971a]" />
            <div className="w-3 h-3 rounded-full bg-[#d79921]" />
          </div>
          {displayFileName && (
            <span className="ml-2 text-xs text-[#928374] font-sans">
              {displayFileName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {language && (
            <span className="text-xs text-[#928374] font-sans">
              {language}
            </span>
          )}
          <button
            onClick={copyToClipboard}
            className="p-1.5 rounded-md hover:bg-[#3c3836] transition-colors"
          >
            {isCopied ? (
              <Check className="h-4 w-4 text-[#b8bb26]" />
            ) : (
              <Copy className="h-4 w-4 text-[#928374] hover:text-[#ebdbb2]" />
            )}
          </button>
        </div>
      </div>

      <pre style={{ margin: 0, padding: "1rem", backgroundColor: "#282828" }}>
        <code
          className={cn("text-sm block font-mono hljs", language && `language-${language}`)}
          style={{
            whiteSpace: "pre",
            fontFamily: "var(--font-jetbrains-mono), monospace"
          }}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  );
}