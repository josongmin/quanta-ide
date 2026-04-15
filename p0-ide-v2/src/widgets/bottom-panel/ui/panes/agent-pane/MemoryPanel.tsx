import { memory } from "./agent-pane.mock";
import { LogButton } from "./LogButton";

export function MemoryPanel({ onOpenLog }: { onOpenLog: () => void }) {
  const typeCount = new Set(memory.map((m) => m.type)).size;
  return (
    <section className="agst-col agst-col--mem">
      <div className="agst-col__h">
        <span className="agst-col__label">Memory</span>
        <span className="agst-col__count">{memory.length}</span>
        <span className="agst-col__right">{typeCount} types</span>
        <LogButton label="Memory" onClick={onOpenLog} />
      </div>
      <ul className="agst-mem">
        {memory.map((m) => (
          <li key={m.name} className="agst-mem__row">
            <span className={`agst-mem__type agst-mem__type--${m.type}`}>{m.type}</span>
            <div className="agst-mem__body">
              <span className="agst-mem__name">{m.name}</span>
              <span className="agst-mem__summary">{m.summary}</span>
            </div>
            <span className="agst-mem__when">{m.updated}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
