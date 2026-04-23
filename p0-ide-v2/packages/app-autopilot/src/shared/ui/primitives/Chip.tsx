import type { ReactNode } from "react";
import { cn } from "@quanta/ui-kit/lib";
import "./chip.css";

export type ChipTone = "neutral" | "accent" | "success" | "warn" | "danger" | "muted";

export interface ChipProps {
  tone?: ChipTone;
  leading?: ReactNode;
  children: ReactNode;
  mono?: boolean;
  className?: string;
  title?: string;
}

export function Chip({ tone = "neutral", leading, children, mono, className, title }: ChipProps) {
  return (
    <span
      className={cn("ap-chip", `ap-chip--${tone}`, mono && "ap-chip--mono", className)}
      title={title}
    >
      {leading != null && <span className="ap-chip__lead">{leading}</span>}
      <span className="ap-chip__label">{children}</span>
    </span>
  );
}
