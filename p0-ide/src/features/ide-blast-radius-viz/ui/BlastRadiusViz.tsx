import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { BLAST_NODES, type BlastNode } from "../model/blast-data";

const HOP_LABEL: Record<1 | 2 | 3, string> = { 1: "direct", 2: "2-hop", 3: "3-hop" };

const KIND_PREFIX: Record<string, string> = {
  function: "ƒ",
  method: "ƒ",
  class: "C",
  type: "T",
  const: "k",
};

const COLLAPSED_LIMIT = 7;

interface BlastRadiusVizProps {
  centerLabel?: string;
  onNodeClick?: (label: string) => void;
}

export function BlastRadiusViz({ centerLabel, onNodeClick }: BlastRadiusVizProps = {}) {
  const { t } = useTranslation();
  const [listExpanded, setListExpanded] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const sorted = useMemo(
    () => [...BLAST_NODES].sort((a, b) => b.risk - a.risk || b.coupling - a.coupling),
    [],
  );

  const total = sorted.length;
  const direct = sorted.filter((n) => n.hop === 1).length;
  const hot = sorted.filter((n) => n.hot === true).length;
  const totalSymbols = sorted.reduce((sum, n) => sum + n.symbols.length, 0);

  const visible = listExpanded ? sorted : sorted.slice(0, COLLAPSED_LIMIT);
  const remaining = total - COLLAPSED_LIMIT;

  const toggleFile = useCallback((id: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleFileClick = useCallback(
    (n: BlastNode) => { onNodeClick?.(n.label); },
    [onNodeClick],
  );

  return (
    <div className="brviz">
      <div className="sii-section-header">
        <span className="sii-section-label">
          {t("ide.inspector.blastRadius")}
          {centerLabel && <span className="brviz-target">{centerLabel}</span>}
        </span>
      </div>

      <div className="brviz-stats">
        <div className="brviz-stat">
          <span className="brviz-stat-k">{t("ide.blastViz.total")}</span>
          <span className="brviz-stat-v">{total}</span>
        </div>
        <div className="brviz-stat">
          <span className="brviz-stat-k">{t("ide.blastViz.direct")}</span>
          <span className="brviz-stat-v">{direct}</span>
        </div>
        <div className="brviz-stat">
          <span className="brviz-stat-k">{t("ide.blastViz.hotPath")}</span>
          <span className="brviz-stat-v">{hot}</span>
        </div>
      </div>

      <ul className="brviz-list">
        {visible.map((n) => {
          const fileExpanded = expandedFiles.has(n.id);
          const symCount = n.symbols.length;
          return (
            <li key={n.id} className="brviz-row-group">
              <div className="brviz-row">
                <button
                  type="button"
                  className="brviz-row-btn"
                  onClick={() => { handleFileClick(n); }}
                >
                  <span className="brviz-dot" data-risk={n.risk} />
                  <span className="brviz-row-name">{n.label}</span>
                  <span className="brviz-row-hop">{HOP_LABEL[n.hop]}</span>
                  {n.hot === true && <span className="brviz-row-hot">hot</span>}
                  <span className="brviz-row-bar-track">
                    <span className="brviz-row-bar-fill" data-risk={n.risk} style={{ width: `${(n.coupling * 100).toFixed(0)}%` }} />
                  </span>
                </button>
                {symCount > 0 && (
                  <button
                    type="button"
                    className={`brviz-sym-toggle${fileExpanded ? " is-open" : ""}`}
                    onClick={() => { toggleFile(n.id); }}
                    aria-label={`${symCount} symbols`}
                    aria-expanded={fileExpanded}
                  >
                    {symCount}
                  </button>
                )}
              </div>

              {fileExpanded && (
                <ul className="brviz-sym-list">
                  {n.symbols.map((s) => (
                    <li key={s.name} className="brviz-sym">
                      <span className="brviz-sym-kind" data-risk={s.risk}>{KIND_PREFIX[s.kind] ?? "?"}</span>
                      <span className="brviz-sym-name">{s.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {!listExpanded && remaining > 0 && (
        <button type="button" className="brviz-expand" onClick={() => { setListExpanded(true); }}>
          + {remaining} {t("ide.blastViz.moreFiles")} · {totalSymbols} symbols
        </button>
      )}
      {listExpanded && total > COLLAPSED_LIMIT && (
        <button type="button" className="brviz-expand" onClick={() => { setListExpanded(false); }}>
          {t("ide.blastViz.collapse")}
        </button>
      )}
    </div>
  );
}
