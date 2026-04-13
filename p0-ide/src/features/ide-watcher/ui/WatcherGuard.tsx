import type { GuardStatus } from "@/entities/watcher";

interface Props {
  guard: GuardStatus;
}

const SEV_ICON: Record<string, string> = { pass: "✓", warn: "!", block: "✕" };

export function WatcherGuard({ guard }: Props) {
  const total = guard.passed + guard.warnings + guard.blocked;

  return (
    <div className="wt-guard" aria-label="Guard status">
      <div className="wt-guard-header">
        <span className="wt-section-title">Guard</span>
        <span className={`wt-guard-summary ${guard.blocked > 0 ? "is-blocked" : guard.warnings > 0 ? "is-warn" : "is-clear"}`}>
          {guard.blocked > 0 ? `${guard.blocked} blocked` : guard.warnings > 0 ? `${guard.warnings} warn` : "all clear"}
        </span>
      </div>

      <div className="wt-guard-meter">
        <div className="wt-guard-bar">
          {total > 0 && (
            <>
              <div className="wt-guard-seg wt-guard-seg-pass" style={{ flex: guard.passed }} />
              {guard.warnings > 0 && <div className="wt-guard-seg wt-guard-seg-warn" style={{ flex: guard.warnings }} />}
              {guard.blocked > 0 && <div className="wt-guard-seg wt-guard-seg-block" style={{ flex: guard.blocked }} />}
            </>
          )}
        </div>
        <div className="wt-guard-nums">
          <span className="wt-guard-num wt-guard-num-pass">{guard.passed}</span>
          <span className="wt-guard-num wt-guard-num-warn">{guard.warnings}</span>
          <span className="wt-guard-num wt-guard-num-block">{guard.blocked}</span>
        </div>
      </div>

      {guard.rules.length > 0 && (
        <ul className="wt-guard-rules">
          {guard.rules.map(r => (
            <li key={r.id} className={`wt-guard-rule wt-guard-rule-${r.severity}`}>
              <span className="wt-guard-rule-icon">{SEV_ICON[r.severity]}</span>
              <span className="wt-guard-rule-name">{r.rule}</span>
              {r.file && <span className="wt-guard-rule-file">{r.file}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
