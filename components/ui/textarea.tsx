import * as React from "react"
import TextareaAutosize, { TextareaAutosizeProps } from 'react-textarea-autosize';

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaAutosizeProps>(
  ({ className, ...props }, ref) => {
    return (
      <TextareaAutosize
        className={cn(
          "flex w-full rounded-md border-x border-t border-input bg-background-main px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-gray-400/50 focus-visible:ring-1 focus-visible:ring-gray-300/30 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
