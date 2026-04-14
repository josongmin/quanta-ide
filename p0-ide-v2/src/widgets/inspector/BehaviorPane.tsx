import type { FileFacts } from "@/entities/engine";
import { focusStore } from "@/entities/engine";

const KIND_LABEL = {
  syntax: "syntax",
  semantic: "semantic",
  runtime: "runtime",
} as const;

export function BehaviorPane({ file }: { file: FileFacts }) {
  if (file.behaviorDiff.length === 0) {
    return <div className="empty-pane">No behavior diffs detected.</div>;
  }

  const counts = file.behaviorDiff.reduce(
    (acc, b) => {
      acc[b.kind] += 1;
      return acc;
    },
    { syntax: 0, semantic: 0, runtime: 0 },
  );

  return (
    <div className="behavior-pane">
      <div className="behavior-pane__head">
        <div className="behavior-pane__cat behavior-pane__cat--syntax">
          <div className="behavior-pane__n">{counts.syntax}</div>
          <div className="behavior-pane__k">syntax</div>
        </div>
        <div className="behavior-pane__cat behavior-pane__cat--semantic">
          <div className="behavior-pane__n">{counts.semantic}</div>
          <div className="behavior-pane__k">semantic</div>
        </div>
        <div className="behavior-pane__cat behavior-pane__cat--runtime">
          <div className="behavior-pane__n">{counts.runtime}</div>
          <div className="behavior-pane__k">runtime</div>
        </div>
      </div>

      <ul className="behavior-list">
        {file.behaviorDiff.map((b, i) => (
          <li key={i} className={`behavior-row behavior-row--${b.kind}`}>
            <button
              type="button"
              className="behavior-row__head"
              onClick={() => focusStore.jumpTo(b.line)}
            >
              <span className={`behavior-row__kind behavior-row__kind--${b.kind}`}>
                {KIND_LABEL[b.kind]}
              </span>
              <span className="behavior-row__line">L{b.line}</span>
              <span className="behavior-row__summary">{b.summary}</span>
            </button>
            {(b.before || b.after) && (
              <div className="behavior-row__diff">
                {b.before && (
                  <pre className="behavior-row__before">- {b.before}</pre>
                )}
                {b.after && (
                  <pre className="behavior-row__after">+ {b.after}</pre>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
