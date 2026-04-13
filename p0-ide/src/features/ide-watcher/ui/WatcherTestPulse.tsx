import type { TestPulseEntry } from "@/entities/watcher";

interface Props {
  tests: readonly TestPulseEntry[];
}

const STATUS_ICON: Record<TestPulseEntry["status"], string> = {
  pass: "●",
  fail: "●",
  running: "◌",
  pending: "○",
};

export function WatcherTestPulse({ tests }: Props) {
  const passed = tests.filter(t => t.status === "pass").length;
  const failed = tests.filter(t => t.status === "fail").length;
  const running = tests.filter(t => t.status === "running").length;

  return (
    <div className="wt-test" aria-label="Test pulse">
      <div className="wt-test-header">
        <span className="wt-section-title">Tests</span>
        <div className="wt-test-summary">
          {passed > 0 && <span className="wt-test-chip wt-test-chip-pass">{passed} pass</span>}
          {failed > 0 && <span className="wt-test-chip wt-test-chip-fail">{failed} fail</span>}
          {running > 0 && <span className="wt-test-chip wt-test-chip-run">{running} running</span>}
        </div>
      </div>
      <ul className="wt-test-list">
        {tests.map(t => (
          <li key={t.id} className={`wt-test-item wt-test-item-${t.status}`}>
            <span className="wt-test-icon">{STATUS_ICON[t.status]}</span>
            <span className="wt-test-name">{t.name}</span>
            {t.durationMs !== undefined && (
              <span className="wt-test-dur">{t.durationMs}ms</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
