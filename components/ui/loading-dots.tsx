import { cn } from "@/lib/utils"

interface LoadingDotsProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "small" | "medium" | "large"
}

export function LoadingDots({ 
  size = "medium", 
  className,
  ...props 
}: LoadingDotsProps) {
  return (
    <div
      className={cn(
        "flex items-center space-x-1",
        size === "small" && "scale-75",
        size === "large" && "scale-125",
        className
      )}
      {...props}
    >
      <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-[loading-dot_1.4s_ease-in-out_infinite]" />
      <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-[loading-dot_1.4s_ease-in-out_0.2s_infinite]" />
      <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-[loading-dot_1.4s_ease-in-out_0.4s_infinite]" />
    </div>
  )
} 