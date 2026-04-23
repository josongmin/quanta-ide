import { cn } from "@quanta/ui-kit/lib";
import "./stat-dot.css";

export type StatDotTone = "neutral" | "accent" | "success" | "warn" | "danger" | "muted" | "purple";

export interface StatDotProps {
  tone?: StatDotTone;
  pulse?: boolean;
  className?: string;
  title?: string;
}

export function StatDot({ tone = "neutral", pulse, className, title }: StatDotProps) {
  return (
    <span
      className={cn("ap-dot", `ap-dot--${tone}`, pulse && "ap-dot--pulse", className)}
      title={title}
      aria-hidden
    />
  );
}
