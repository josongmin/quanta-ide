import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getCoverageGaps, type CoverageGapFile } from "../model/coverage-gap-data";

const KIND_PREFIX: Record<string, string> = { function: "ƒ", method: "ƒ", class: "C" };

interface CoverageGapPanelProps {
  fileName?: string;
}

export function CoverageGapPanel({ fileName = "orchestrator.py" }: CoverageGapPanelProps) {
  const { t } = useTranslation();
  const gaps = getCoverageGaps(fileName);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (gaps.length === 0) return null;

  const totalUncovered = gaps.reduce((s, f) => s + f.uncovered.length, 0);
  const totalFuncs = gaps.reduce((s, f) => s + f.total, 0);
  const totalCovered = gaps.reduce((s, f) => s + f.covered, 0);
  const pct = totalFuncs > 0 ? Math.round((totalCovered / totalFuncs) * 100) : 0;

  return (
    <div className="cgap">
      <div className="sii-section-header">
        <span className="sii-section-label">{t("ide.coverageGap.title")}</span>
      </div>

      <div className="cgap-stats">
        <div className="cgap-stat">
          <span className="cgap-stat-k">{t("ide.coverageGap.coverage")}</span>
          <span className="cgap-stat-v">{pct}%</span>
        </div>
        <div className="cgap-stat">
          <span className="cgap-stat-k">{t("ide.coverageGap.uncovered")}</span>
          <span className="cgap-stat-v">{totalUncovered}</span>
        </div>
        <div className="cgap-stat">
          <span className="cgap-stat-k">{t("ide.coverageGap.files")}</span>
          <span className="cgap-stat-v">{gaps.length}</span>
        </div>
      </div>

      <ul className="cgap-list">
        {gaps.map((f) => (
          <FileRow key={f.id} file={f} isExpanded={expanded.has(f.id)} onToggle={() => { toggle(f.id); }} />
        ))}
      </ul>
    </div>
  );
}

function FileRow({ file, isExpanded, onToggle }: { file: CoverageGapFile; isExpanded: boolean; onToggle: () => void }) {
  const pct = Math.round((file.covered / file.total) * 100);
  return (
    <li className="cgap-file">
      <button type="button" className="cgap-file-row" onClick={onToggle}>
        <span className="cgap-file-name">{file.file}</span>
        <span className="cgap-file-ratio">{file.covered}/{file.total}</span>
        <span className="cgap-file-bar-track">
          <span className="cgap-file-bar-fill" style={{ width: `${pct.toString()}%` }} />
        </span>
        <span className="cgap-file-gap">−{file.uncovered.length}</span>
      </button>
      {isExpanded && (
        <ul className="cgap-sym-list">
          {file.uncovered.map((s) => (
            <li key={s.name} className="cgap-sym">
              <span className="cgap-sym-kind" data-risk={s.risk}>{KIND_PREFIX[s.kind] ?? "?"}</span>
              <span className="cgap-sym-name">{s.name}</span>
              <span className="cgap-sym-line">:{s.line}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
