import React, { useState, useEffect } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import hljs from 'highlight.js';
import '@/styles/gruvbox-dark.css';

interface CodeBlockProps {
  language?: string;
  value: string;
  className?: string;
}

export function CodeBlock({ language, value, className }: CodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState(value);

  useEffect(() => {
    if (language) {
      const highlighted = hljs.highlight(value, { language }).value;
      setHighlightedCode(highlighted);
    } else {
      setHighlightedCode(value);
    }
  }, [language, value]);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(value);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className={cn(
      'relative group rounded-xl bg-[#282828] shadow-md',
      className
    )}>
      {/* Sticky container that spans full height */}
      <div className="sticky top-0 z-10 rounded-t-xl bg-[#282828] border border-[#3c3836]">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#1d2021] border-b border-[#3c3836] rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#cc241d]" />
              <div className="w-3 h-3 rounded-full bg-[#98971a]" />
              <div className="w-3 h-3 rounded-full bg-[#d79921]" />
            </div>
            {language && (
              <span className="text-xs text-[#928374] ml-2 font-sans">{language}</span>
            )}
          </div>
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

      {/* Code content */}
      <div className="border border-t-0 border-[#3c3836] rounded-b-xl">
        <pre className="p-4 overflow-x-auto bg-[#282828]">
          <code 
            className={cn('text-sm block', 'font-mono hljs', language && `language-${language}`)}
            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      </div>
    </div>
  );
} 