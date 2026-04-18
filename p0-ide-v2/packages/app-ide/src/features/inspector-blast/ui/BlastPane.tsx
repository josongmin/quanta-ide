import type { FileFacts } from "@quanta/app-ide/entities/file";
import { tone, RISK_HIGH, RISK_MID } from "@quanta/app-ide/entities/risk";

const REASON_LABEL: Record<string, string> = {
  "direct-caller": "direct caller",
  "transitive-caller": "transitive",
  "shared-data": "shared data",
  "test": "test",
};

export function BlastPane({ file }: { file: FileFacts }) {
  const sorted = [...file.blastTargets].sort((a, b) => b.riskScore - a.riskScore);
  const critical = sorted.filter((t) => t.riskScore >= RISK_HIGH).length;
  const high = sorted.filter((t) => t.riskScore >= RISK_MID && t.riskScore < RISK_HIGH).length;

  return (
    <div className="blast-pane">
      <div className="blast-pane__head">
        <div className="blast-pane__stat">
          <div className="blast-pane__stat-v">{file.blast}</div>
          <div className="blast-pane__stat-k">affected files</div>
        </div>
        <div className="blast-pane__stat">
          <div className="blast-pane__stat-v blast-pane__stat-v--bad">{critical}</div>
          <div className="blast-pane__stat-k">critical</div>
        </div>
        <div className="blast-pane__stat">
          <div className="blast-pane__stat-v blast-pane__stat-v--warn">{high}</div>
          <div className="blast-pane__stat-k">high</div>
        </div>
      </div>

      <ul className="blast-list">
        {sorted.map((t) => {
          const rowTone = tone(t.riskScore);
          return (
            <li key={t.file} className={`blast-row blast-row--${rowTone}`}>
              <span className="blast-row__risk">{t.riskScore}</span>
              <div className="blast-row__body">
                <div className="blast-row__file">{t.file}</div>
                <div className="blast-row__path">
                  {t.callPath.map((p, i) => (
                    <span key={i}>
                      <span className="blast-row__seg">{p}</span>
                      {i < t.callPath.length - 1 && <span className="blast-row__arrow">→</span>}
                    </span>
                  ))}
                </div>
              </div>
              <span className={`blast-row__reason blast-row__reason--${t.reason}`}>
                {REASON_LABEL[t.reason]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
