import type { ReactNode } from "react";

export function formatInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function renderMessageBody(text: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const chunks = text.split("```");
  chunks.forEach((block, i) => {
    if (i % 2 === 1) {
      const lines = block.split("\n");
      const lang = lines[0] && !lines[0].includes(" ") ? lines[0] : "";
      const code = lines.slice(lang ? 1 : 0).join("\n");
      blocks.push(
        <pre key={`c${i}`} data-lang={lang}>
          <code>{code}</code>
        </pre>,
      );
      return;
    }
    const paragraphs = block.split("\n\n");
    paragraphs.forEach((para, j) => {
      if (!para.trim()) return;
      const lines = para.split("\n");
      const isList = lines.every((l) => l.trim().startsWith("- "));
      if (isList) {
        blocks.push(
          <ul key={`l${i}-${j}`}>
            {lines.map((l, k) => (
              <li key={k}>{formatInline(l.replace(/^-\s*/, ""))}</li>
            ))}
          </ul>,
        );
      } else {
        blocks.push(<p key={`p${i}-${j}`}>{formatInline(para)}</p>);
      }
    });
  });
  return blocks;
}
