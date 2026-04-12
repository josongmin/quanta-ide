import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getDeadSymbolsFromDB } from "@/app/ide/analysis-data";

const KIND_PREFIX: Record<string, string> = {
  function: "ƒ", method: "ƒ", class: "C", type: "T", const: "k",
};

interface DeadCodePanelProps {
  fileName?: string;
}

export function DeadCodePanel({ fileName = "orchestrator.py" }: DeadCodePanelProps) {
  const { t } = useTranslation();
  const symbols = getDeadSymbolsFromDB(fileName);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (symbols.length === 0) return null;

  const highCount = symbols.length; // all DB-sourced symbols are high confidence

  return (
    <div className="dcode">
      <div className="sii-section-header">
        <span className="sii-section-label">{t("ide.deadCode.title")}</span>
      </div>

      <div className="dcode-stats">
        <div className="dcode-stat">
          <span className="dcode-stat-k">{t("ide.deadCode.total")}</span>
          <span className="dcode-stat-v">{symbols.length}</span>
        </div>
        <div className="dcode-stat">
          <span className="dcode-stat-k">{t("ide.deadCode.highConf")}</span>
          <span className="dcode-stat-v">{highCount}</span>
        </div>
      </div>

      <ul className="dcode-list">
        {symbols.map((sym) => (
          <li key={sym.id} className="dcode-item">
            <button type="button" className="dcode-row" onClick={() => { toggle(sym.id); }}>
              <span className="dcode-kind">{KIND_PREFIX[sym.kind] ?? "?"}</span>
              <span className="dcode-name">{sym.name}</span>
              <span className="dcode-file">{sym.file}:{sym.line}</span>
              <span className={`dcode-conf dcode-conf--${sym.confidence}`}>{sym.confidence}</span>
            </button>
            {expanded.has(sym.id) && (
              <div className="dcode-detail">
                <span className="dcode-reason">{sym.reason}</span>
                {sym.lastCalled !== null && (
                  <span className="dcode-last">{t("ide.deadCode.lastCalled")}: {sym.lastCalled}</span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
