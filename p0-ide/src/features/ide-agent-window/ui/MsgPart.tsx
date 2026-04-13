import type { ReactNode } from "react";
import type { MsgContent } from "../model/types";
import { Dot } from "./icons";

/* eslint-disable @typescript-eslint/no-explicit-any -- discriminated-union parts are narrowed by key */
const PART_RENDERERS: Record<string, (part: any) => ReactNode> = {
  text(p: Extract<MsgContent, { type: "text" }>) {
    const html = p.text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return <span style={{ display: "block" }} dangerouslySetInnerHTML={{ __html: html }} />;
  },

  metrics(p: Extract<MsgContent, { type: "metrics" }>) {
    return (
      <div className="agw-inline-metrics">
        {p.items.map((m) => (
          <div key={m.label} className="agw-inline-metric">
            <div className="agw-inline-metric-label">{m.label}</div>
            <div className={`agw-inline-metric-val${m.risk ? " is-risk" : ""}`}>{m.value}</div>
          </div>
        ))}
      </div>
    );
  },

  bullets(p: Extract<MsgContent, { type: "bullets" }>) {
    return (
      <div className="agw-chat-bullets">
        {p.items.map((b) => (
          <div key={b} className="agw-chat-bullet">
            <Dot />
            <span>{b}</span>
          </div>
        ))}
      </div>
    );
  },

  code(p: Extract<MsgContent, { type: "code" }>) {
    return (
      <div className="agw-code-block">
        <div className="agw-code-block-header">
          {p.block.lang}
          {p.block.file && <span>{p.block.file}</span>}
        </div>
        <pre dangerouslySetInnerHTML={{ __html: p.block.code }} />
      </div>
    );
  },

  artifacts(p: Extract<MsgContent, { type: "artifacts" }>) {
    return (
      <div className="agw-chat-artifacts">
        {p.items.map((a) => (
          <button key={a} type="button" className="agw-artifact-chip">{a}</button>
        ))}
      </div>
    );
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export function MsgPart({ part }: { part: MsgContent }) {
  const render = PART_RENDERERS[part.type];
  return <>{render(part)}</>;
}
