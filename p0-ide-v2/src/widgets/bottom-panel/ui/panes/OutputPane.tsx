import { useState } from "react";
import { OUTPUT_SOURCES, OUTPUT_LOGS, type OutputSource } from "@/entities/output";

export function OutputPane() {
  const [source, setSource] = useState<OutputSource>("build");
  const [wrap, setWrap] = useState(true);

  return (
    <div className="pane pane--output">
      <div className="pb-toolbar">
        <span className="pb-panel-title">Output</span>
        <span className="pb-toolbar-sep" aria-hidden />
        <div className="pb-seg" role="tablist" aria-label="Output source">
          {OUTPUT_SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={source === s.id}
              className={`pb-seg-btn${source === s.id ? " is-active" : ""}`}
              onClick={() => setSource(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={wrap}
          className={`pb-chip pb-chip-info${wrap ? " is-active" : ""}`}
          onClick={() => setWrap((w) => !w)}
          title="Wrap long lines"
        >
          <span className="pb-chip-dot" aria-hidden />
          <span className="pb-chip-label">Wrap</span>
        </button>
        <div className="pb-toolbar-spacer" />
        <button type="button" className="pb-toolbar-action">Clear</button>
      </div>
      <pre className={`out-body${wrap ? "" : " is-nowrap"}`}>{OUTPUT_LOGS[source]}</pre>
    </div>
  );
}
