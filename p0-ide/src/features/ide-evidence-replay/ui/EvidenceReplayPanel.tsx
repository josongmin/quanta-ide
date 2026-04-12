import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SAMPLE_EVIDENCE, type ReplayStatus } from "../model/evidence-data";

const STATUS_ICON: Record<ReplayStatus, string> = {
  idle: "○",
  running: "◌",
  passed: "✓",
  failed: "✕",
};

export function EvidenceReplayPanel() {
  const { t } = useTranslation();
  const data = SAMPLE_EVIDENCE;
  const [replayState, setReplayState] = useState<Record<string, ReplayStatus>>({});
  const [isReplaying, setIsReplaying] = useState(false);

  const runReplay = useCallback(() => {
    if (isReplaying) return;
    setIsReplaying(true);
    const steps = data.replay;
    let i = 0;
    const init: Record<string, ReplayStatus> = {};
    for (const s of steps) init[s.id] = "idle";
    setReplayState(init);

    const next = () => {
      if (i >= steps.length) { setIsReplaying(false); return; }
      const step = steps[i];
      setReplayState((prev) => ({ ...prev, [step.id]: "running" }));
      setTimeout(() => {
        setReplayState((prev) => ({ ...prev, [step.id]: step.status }));
        i++;
        next();
      }, 400 + Math.random() * 300);
    };
    next();
  }, [isReplaying, data.replay]);

  const verifiedCount = data.evidence.filter((e) => e.verified).length;

  return (
    <div className="evreplay">
      <div className="sii-section-header">
        <span className="sii-section-label">{t("ide.evidenceReplay.title")}</span>
      </div>

      <div className="evreplay-stats">
        <div className="evreplay-stat">
          <span className="evreplay-stat-k">{t("ide.evidenceReplay.evidence")}</span>
          <span className="evreplay-stat-v">{data.evidence.length}</span>
        </div>
        <div className="evreplay-stat">
          <span className="evreplay-stat-k">{t("ide.evidenceReplay.verified")}</span>
          <span className="evreplay-stat-v">{verifiedCount}/{data.evidence.length}</span>
        </div>
        <div className="evreplay-stat">
          <span className="evreplay-stat-k">{t("ide.evidenceReplay.steps")}</span>
          <span className="evreplay-stat-v">{data.replay.length}</span>
        </div>
      </div>

      {/* Evidence list */}
      <div className="evreplay-section">
        <div className="evreplay-section-label">{t("ide.evidenceReplay.evidenceLabel")}</div>
        <ul className="evreplay-elist">
          {data.evidence.map((e) => (
            <li key={e.id} className={`evreplay-eitem${e.verified ? " is-verified" : ""}`}>
              <span className="evreplay-echeck">{e.verified ? "✓" : "○"}</span>
              <span className="evreplay-elabel">{e.label}</span>
              {e.loc !== undefined && <span className="evreplay-eloc">{e.loc}</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* Replay */}
      <div className="evreplay-section">
        <div className="evreplay-section-header">
          <span className="evreplay-section-label">{t("ide.evidenceReplay.replayLabel")}</span>
          <button
            type="button"
            className="evreplay-run-btn"
            onClick={runReplay}
            disabled={isReplaying}
          >
            {isReplaying ? t("ide.evidenceReplay.running") : t("ide.evidenceReplay.runReplay")}
          </button>
        </div>
        <ul className="evreplay-rlist">
          {data.replay.map((step) => {
            const status = replayState[step.id] ?? "idle";
            return (
              <li key={step.id} className={`evreplay-rstep evreplay-rstep--${status}`}>
                <span className="evreplay-rstatus">{STATUS_ICON[status]}</span>
                <span className="evreplay-rlabel">{step.label}</span>
                {step.durationMs !== undefined && status === "passed" && (
                  <span className="evreplay-rdur">{(step.durationMs / 1000).toFixed(1)}s</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
