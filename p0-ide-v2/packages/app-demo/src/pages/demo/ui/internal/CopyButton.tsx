import { useState, type JSX } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  value: string;
  label?: string;
  successLabel?: string;
  timeoutMs?: number;
  size?: "sm" | "md";
  variant?: "ghost" | "soft";
  icon?: boolean;
}

export function CopyButton({
  value,
  label = "Copy",
  successLabel = "Copied",
  timeoutMs = 1500,
  size = "md",
  variant = "ghost",
  icon = true,
}: CopyButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    try {
      void navigator.clipboard?.writeText(value).catch(() => {});
    } catch {
      // no-op: clipboard unavailable
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), timeoutMs);
  };

  const iconSize = size === "sm" ? 10 : 11;
  const iconStroke = 2;
  const displayLabel = copied ? successLabel : label;
  const IconCmp = copied ? Check : Copy;

  if (variant === "ghost") {
    return (
      <button
        type="button"
        className="demo-btn demo-btn--ghost"
        onClick={onCopy}
        aria-live="polite"
        aria-label={displayLabel}
      >
        {icon ? <IconCmp size={iconSize} strokeWidth={iconStroke} /> : null}
        {displayLabel}
      </button>
    );
  }

  const height = size === "sm" ? 22 : 26;
  const fontSize = size === "sm" ? 9 : 10;

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-live="polite"
      aria-label={displayLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "0 var(--space-2h)",
        height,
        border: `1px solid ${copied ? "var(--success)" : "var(--border)"}`,
        borderRadius: "var(--radius-xs)",
        background: copied ? "var(--bg-success-subtle)" : "var(--bg-subtle)",
        color: copied ? "var(--success)" : "var(--fg)",
        fontSize,
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {icon ? <IconCmp size={iconSize} strokeWidth={iconStroke} /> : null}
      {displayLabel}
    </button>
  );
}
