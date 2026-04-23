import { cn } from "@quanta/ui-kit/lib";
import "./thinking-dots.css";

export function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn("ap-thinking", className)} aria-label="thinking">
      <span className="ap-thinking__dot" />
      <span className="ap-thinking__dot" />
      <span className="ap-thinking__dot" />
    </span>
  );
}
