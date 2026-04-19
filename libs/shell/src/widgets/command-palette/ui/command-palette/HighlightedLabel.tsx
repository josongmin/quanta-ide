import type { ReactNode } from "react";

export function HighlightedLabel({
  text,
  positions,
}: {
  text: string;
  positions: readonly number[];
}) {
  if (positions.length === 0) return <>{text}</>;
  const set = new Set(positions);
  const out: ReactNode[] = [];
  let buf = "";
  for (let i = 0; i < text.length; i++) {
    if (set.has(i)) {
      if (buf) {
        out.push(<span key={`p${i}`}>{buf}</span>);
        buf = "";
      }
      out.push(
        <mark key={`m${i}`} className="cp__hl">
          {text[i]}
        </mark>,
      );
    } else {
      buf += text[i];
    }
  }
  if (buf) out.push(<span key="tail">{buf}</span>);
  return <>{out}</>;
}
