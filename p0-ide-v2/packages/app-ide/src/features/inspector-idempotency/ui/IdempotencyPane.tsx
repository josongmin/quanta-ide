import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getIdempotencyMap,
  type IdemDuplicateBehavior,
  type IdemKeyStrategy,
  type IdemRisk,
} from "@quanta/app-ide/entities/idempotency";
import { focusStore } from "@quanta/app-ide/stores/focus-store";

const KEY_LABEL: Record<IdemKeyStrategy, string> = {
  "header-key": "Header key",
  "request-id": "Request ID",
  "natural-key": "Natural key",
  "dedupe-table": "Dedupe table",
  none: "NONE",
};

const BEHAV_LABEL: Record<IdemDuplicateBehavior, string> = {
  noop: "no-op",
  "double-effect": "doubles",
  error: "errors",
  unknown: "unknown",
};

function tone(score: number): "ok" | "warn" | "bad" | "crit" {
  if (score < 25) return "ok";
  if (score < 50) return "warn";
  if (score < 80) return "bad";
  return "crit";
}

export function IdempotencyPane({ file }: { file: FileFacts }) {
  const map = useMemo(() => getIdempotencyMap(file.name), [file.name]);
  const sorted = useMemo(() => [...map.risks].sort((a, b) => b.riskScore - a.riskScore), [map]);
  const [activeId, setActiveId] = useState(sorted[0]?.id);
  const [showSim, setShowSim] = useState(false);

  const active = sorted.find((r) => r.id === activeId) ?? sorted[0];

  const crit = sorted.filter((r) => r.riskScore >= 80).length;
  const high = sorted.filter((r) => r.riskScore >= 50 && r.riskScore < 80).length;

  return (
    <div className="idem-pane">
      <div className="idem-head">
        <div className="idem-head__stat">
          <div className="idem-head__stat-v">{sorted.length}</div>
          <div className="idem-head__stat-k">write ops</div>
        </div>
        <div className="idem-head__stat">
          <div className="idem-head__stat-v idem-head__stat-v--crit">{crit}</div>
          <div className="idem-head__stat-k">critical</div>
        </div>
        <div className="idem-head__stat">
          <div className="idem-head__stat-v idem-head__stat-v--bad">{high}</div>
          <div className="idem-head__stat-k">high</div>
        </div>
      </div>

      <ul className="idem-list">
        {sorted.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className={`idem-row idem-row--${tone(r.riskScore)}${r.id === active?.id ? " is-active" : ""}`}
              onClick={() => setActiveId(r.id)}
            >
              <ScoreDial score={r.riskScore} />
              <div className="idem-row__main">
                <div className="idem-row__sym">{r.symbol}</div>
                <div className="idem-row__effect">{r.effect}</div>
              </div>
              <div className="idem-row__chips">
                <span className={`idem-chip idem-chip--key idem-chip--key-${r.keyStrategy === "none" ? "missing" : "ok"}`}>
                  {KEY_LABEL[r.keyStrategy]}
                </span>
                <span className={`idem-chip idem-chip--beh idem-chip--beh-${r.duplicateBehavior}`}>
                  {BEHAV_LABEL[r.duplicateBehavior]}
                </span>
                <span className={`idem-chip idem-chip--imp idem-chip--imp-${r.impact}`}>
                  {r.impact}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {active && (
        <RiskDetail risk={active} showSim={showSim} onToggleSim={() => setShowSim((s) => !s)} />
      )}
    </div>
  );
}

function ScoreDial({ score }: { score: number }) {
  const t = tone(score);
  const r = 14;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  return (
    <svg className={`idem-dial idem-dial--${t}`} width={36} height={36} viewBox="0 0 36 36">
      <circle cx={18} cy={18} r={r} className="idem-dial__bg" />
      <circle
        cx={18}
        cy={18}
        r={r}
        className="idem-dial__fg"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 18 18)"
      />
      <text x={18} y={21} textAnchor="middle" className="idem-dial__txt">{score}</text>
    </svg>
  );
}

function RiskDetail({
  risk,
  showSim,
  onToggleSim,
}: {
  risk: IdemRisk;
  showSim: boolean;
  onToggleSim: () => void;
}) {
  return (
    <section className="idem-detail">
      <header className="idem-detail__h">
        <button type="button" className="idem-detail__sym" onClick={() => focusStore.jumpTo(risk.line)}>
          {risk.symbol}
          <span className="idem-detail__loc">{risk.file}:{risk.line}</span>
        </button>
      </header>
      <p className="idem-detail__effect">{risk.effect}</p>

      <div className="idem-detail__grid">
        <Field label="Key strategy" value={KEY_LABEL[risk.keyStrategy]} state={risk.keyStrategy === "none" ? "bad" : "ok"} />
        <Field label="Duplicate behavior" value={BEHAV_LABEL[risk.duplicateBehavior]} state={risk.duplicateBehavior === "double-effect" ? "bad" : "ok"} />
        <Field label="Impact" value={risk.impact} state={risk.impact === "irreversible" ? "bad" : risk.impact === "high" ? "warn" : "ok"} />
        <Field label="Retry origin" value={risk.retryOrigin} state="muted" />
        <Field label="Double-fire test" value={risk.hasDoubleFireTest ? "yes" : "missing"} state={risk.hasDoubleFireTest ? "ok" : "warn"} />
      </div>

      <button type="button" className="idem-sim__btn" onClick={onToggleSim}>
        {showSim ? "Hide simulation" : "Simulate duplicate request"}
      </button>

      {showSim && (
        <div className="idem-sim">
          <div className="idem-sim__step">
            <span className="idem-sim__seq">1</span>
            <span className="idem-sim__txt">Client sends request → server applies effect.</span>
            <span className="idem-sim__state">applied</span>
          </div>
          <div className="idem-sim__step">
            <span className="idem-sim__seq">2</span>
            <span className="idem-sim__txt">Network drops response · client retries.</span>
            <span className="idem-sim__state">retry</span>
          </div>
          <div className={`idem-sim__step idem-sim__step--final${risk.duplicateBehavior === "double-effect" ? " is-bad" : " is-ok"}`}>
            <span className="idem-sim__seq">3</span>
            <span className="idem-sim__txt">
              {risk.duplicateBehavior === "double-effect"
                ? "Server re-applies effect — DOUBLE EXECUTION."
                : risk.duplicateBehavior === "error"
                ? "Server returns 409 conflict — caller must reconcile."
                : "Server detects duplicate, returns cached result — safe."}
            </span>
            <span className="idem-sim__state">{risk.duplicateBehavior === "double-effect" ? "BUG" : "safe"}</span>
          </div>
        </div>
      )}

      <div className="idem-detail__hint">
        <span className="idem-detail__hint-label">Remediation</span>
        <span>{risk.hint}</span>
      </div>
    </section>
  );
}

function Field({ label, value, state }: { label: string; value: string; state: "ok" | "warn" | "bad" | "muted" }) {
  return (
    <div className={`idem-field idem-field--${state}`}>
      <div className="idem-field__k">{label}</div>
      <div className="idem-field__v">{value}</div>
    </div>
  );
}
