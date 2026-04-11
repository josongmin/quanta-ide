import { useTranslation } from "react-i18next";
import { SNAPSHOTS, useTimeTravel } from "../model/useTimeTravel";

export function TimeTravelCompare() {
  const { t } = useTranslation();
  const { isOpen, selectedId } = useTimeTravel();
  if (!isOpen) return null;

  const selected = SNAPSHOTS.find((s) => s.id === selectedId);
  const current = SNAPSHOTS[SNAPSHOTS.length - 1];
  if (!selected || selected.id === current.id) return null;

  const blastDiff = current.blast - selected.blast;
  const taintDiff = current.taint - selected.taint;

  return (
    <div className="ttcmp">
      <div className="ttcmp-head">
        <span className="ttcmp-label">{t("ide.timeTravel.compareHead")}</span>
        <span className="ttcmp-range">{selected.label} → {t("ide.timeTravel.today")}</span>
      </div>
      <div className="ttcmp-grid">
        <div className="ttcmp-metric">
          <span className="ttcmp-k">{t("ide.metrics.blast")}</span>
          <span className="ttcmp-v">
            {selected.blast} → {current.blast}
            <span className={`ttcmp-delta${blastDiff < 0 ? " is-down" : ""}`}>
              {blastDiff > 0 ? "+" : ""}{blastDiff}
            </span>
          </span>
        </div>
        <div className="ttcmp-metric">
          <span className="ttcmp-k">{t("ide.metrics.taint")}</span>
          <span className="ttcmp-v">
            {selected.taint} → {current.taint}
            <span className={`ttcmp-delta${taintDiff < 0 ? " is-down" : ""}`}>
              {taintDiff > 0 ? "+" : ""}{taintDiff}
            </span>
          </span>
        </div>
      </div>
      {selected.commits.length > 0 && (
        <div className="ttcmp-commits">
          <span className="ttcmp-commits-label">{t("ide.timeTravel.commitsSince")}</span>
          {selected.commits.map((c) => (
            <div key={c.hash} className="ttcmp-commit">
              <span className="ttcmp-hash">{c.hash}</span>
              <span className="ttcmp-msg">{c.msg}</span>
            </div>
          ))}
        </div>
      )}
      {selected.inflection !== undefined && (
        <div className="ttcmp-inflection">
          <span className="ttcmp-inflection-marker">▲</span>
          {selected.inflection}
        </div>
      )}
    </div>
  );
}
