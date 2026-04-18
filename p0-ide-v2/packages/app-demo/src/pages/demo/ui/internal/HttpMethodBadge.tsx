import type { JSX } from "react";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface HttpMethodBadgeProps {
  method: HttpMethod;
  size?: "sm" | "md";
}

const METHOD_TOKEN: Record<HttpMethod, string> = {
  GET: "var(--success)",
  POST: "var(--accent)",
  PUT: "var(--warn)",
  PATCH: "var(--warn)",
  DELETE: "var(--danger)",
};

export function HttpMethodBadge({ method, size = "md" }: HttpMethodBadgeProps): JSX.Element {
  const tone = METHOD_TOKEN[method];
  const height = size === "sm" ? 20 : 22;
  const fontSize = size === "sm" ? 9 : 10;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height,
        padding: "0 var(--space-2)",
        fontFamily: "var(--font-mono)",
        fontSize,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        borderRadius: "var(--radius-xs)",
        color: tone,
        background: `color-mix(in srgb, ${tone} 14%, var(--bg))`,
        border: `1px solid color-mix(in srgb, ${tone} 30%, var(--bg))`,
      }}
    >
      {method}
    </span>
  );
}
