import type { MsgContent } from "../model/types";
import { Dot } from "./icons";

export function MsgPart({ part }: { part: MsgContent }) {
  if (part.type === "text") {
    const html = part.text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return <span style={{ display: "block" }} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  if (part.type === "metrics") {
    return (
      <div className="agw-inline-metrics">
        {part.items.map((m) => (
          <div key={m.label} className="agw-inline-metric">
            <div className="agw-inline-metric-label">{m.label}</div>
            <div className={`agw-inline-metric-val${m.risk ? " is-risk" : ""}`}>{m.value}</div>
          </div>
        ))}
      </div>
    );
  }

  if (part.type === "bullets") {
    return (
      <div className="agw-chat-bullets">
        {part.items.map((b) => (
          <div key={b} className="agw-chat-bullet">
            <Dot />
            <span>{b}</span>
          </div>
        ))}
      </div>
    );
  }

  if (part.type === "code") {
    return (
      <div className="agw-code-block">
        <div className="agw-code-block-header">
          {part.block.lang}
          {part.block.file && <span>{part.block.file}</span>}
        </div>
        <pre dangerouslySetInnerHTML={{ __html: part.block.code }} />
      </div>
    );
  }

  // part.type === "artifacts" (exhaustive)
  return (
    <div className="agw-chat-artifacts">
      {part.items.map((a) => (
        <button key={a} type="button" className="agw-artifact-chip">{a}</button>
      ))}
    </div>
  );
}
