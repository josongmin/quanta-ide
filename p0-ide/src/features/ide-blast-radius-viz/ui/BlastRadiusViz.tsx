import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { BLAST_NODES, type BlastNode } from "../model/blast-data";

interface PositionedNode extends BlastNode {
  x: number;
  y: number;
  r: number;
}

const VIEW = 320;
const CENTER = VIEW / 2;
const RING_R: Record<1 | 2 | 3, number> = { 1: 50, 2: 95, 3: 138 };

function nodeRadius(size: 1 | 2 | 3): number {
  switch (size) {
    case 1: return 3.5;
    case 2: return 5;
    case 3: return 7;
  }
}

function layoutNodes(nodes: BlastNode[]): PositionedNode[] {
  const byRing: Record<1 | 2 | 3, BlastNode[]> = { 1: [], 2: [], 3: [] };
  for (const n of nodes) byRing[n.ring].push(n);

  const positioned: PositionedNode[] = [];
  (Object.keys(byRing) as unknown as ("1" | "2" | "3")[]).forEach((k) => {
    const ring = Number(k) as 1 | 2 | 3;
    const ringNodes = byRing[ring];
    const count = ringNodes.length;
    const offset = ring * 0.35; // de-align rings
    ringNodes.forEach((n, i) => {
      const angle = (i / count) * Math.PI * 2 + offset;
      positioned.push({
        ...n,
        x: CENTER + Math.cos(angle) * RING_R[ring],
        y: CENTER + Math.sin(angle) * RING_R[ring],
        r: nodeRadius(n.size),
      });
    });
  });
  return positioned;
}

interface BlastRadiusVizProps {
  centerLabel?: string;
  onNodeClick?: (label: string) => void;
}

export function BlastRadiusViz({ centerLabel = "processRefund", onNodeClick }: BlastRadiusVizProps = {}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<PositionedNode | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const nodes = useMemo(() => layoutNodes(BLAST_NODES), []);
  const handleNodeClick = useCallback((n: PositionedNode) => {
    setSelected(n.id);
    onNodeClick?.(n.label);
  }, [onNodeClick]);

  const total = BLAST_NODES.length;
  const direct = BLAST_NODES.filter((n) => n.ring === 1).length;
  const hot = BLAST_NODES.filter((n) => n.hot === true).length;

  return (
    <div className="brviz">
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

      <div className="brviz-canvas">
        <svg viewBox={`0 0 ${VIEW.toString()} ${VIEW.toString()}`} className="brviz-svg">
          <defs>
            <radialGradient id="brviz-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
              <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* core glow */}
          <circle cx={CENTER} cy={CENTER} r="40" fill="url(#brviz-core)" />

          {/* concentric rings */}
          {([1, 2, 3] as const).map((ring) => (
            <circle
              key={ring}
              cx={CENTER}
              cy={CENTER}
              r={RING_R[ring]}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeDasharray="2 4"
              className="brviz-ring"
            />
          ))}

          {/* connector lines (center -> ring 1) */}
          {nodes
            .filter((n) => n.ring === 1)
            .map((n) => (
              <line
                key={`line-${n.id}`}
                x1={CENTER}
                y1={CENTER}
                x2={n.x}
                y2={n.y}
                stroke="currentColor"
                strokeOpacity={0.14}
                strokeWidth={n.hot === true ? 1.2 : 0.6}
              />
            ))}

          {/* nodes */}
          {nodes.map((n) => {
            const opacity = 0.3 + n.risk * 0.18;
            const isHovered = hovered?.id === n.id;
            const isSelected = selected === n.id;
            return (
              <g
                key={n.id}
                role="button"
                aria-label={t("ide.blastViz.nodeAria", {
                  label: n.label,
                  n: n.ring,
                  hot: n.hot === true ? t("ide.blastViz.hotSuffix") : "",
                })}
                onMouseEnter={() => { setHovered(n); }}
                onMouseLeave={() => { setHovered(null); }}
                onClick={() => { handleNodeClick(n); }}
                style={{ cursor: "pointer" }}
              >
                {n.hot === true && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.r + 3}
                    fill="var(--accent)"
                    fillOpacity={0.12}
                  />
                )}
                {isSelected && (
                  <circle cx={n.x} cy={n.y} r={n.r + 5} fill="none" stroke="var(--accent)" strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
                )}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={isHovered || isSelected ? n.r + 1.5 : n.r}
                  fill="var(--accent)"
                  fillOpacity={isHovered || isSelected ? 1 : opacity}
                  stroke={isHovered || isSelected ? "var(--accent)" : "none"}
                  strokeWidth={isHovered || isSelected ? 1 : 0}
                  style={{ transition: "r 0.18s ease-out, fill-opacity 0.18s ease-out" }}
                />
              </g>
            );
          })}

          {/* center node */}
          <circle cx={CENTER} cy={CENTER} r="9" fill="var(--accent)" />
          <circle cx={CENTER} cy={CENTER} r="4" fill="var(--paper)" />
        </svg>

        <div className="brviz-center-label">{centerLabel}</div>

        {hovered && (
          <div
            className="brviz-tooltip"
            style={{
              left: `${(hovered.x / VIEW * 100).toString()}%`,
              top: `${(hovered.y / VIEW * 100).toString()}%`,
            }}
          >
            <div className="brviz-tooltip-name">{hovered.label}</div>
            <div className="brviz-tooltip-meta">
              {t("ide.blastViz.tooltipRing", { n: hovered.ring })}
              {hovered.hot === true && <> · {t("ide.blastViz.hot")}</>}
              {hovered.tag && <> · {hovered.tag}</>}
            </div>
          </div>
        )}
      </div>

      <div className="brviz-legend">
        <span className="brviz-legend-item"><i className="brviz-dot brviz-dot-3" /> {t("ide.blastViz.legendDirect")}</span>
        <span className="brviz-legend-item"><i className="brviz-dot brviz-dot-2" /> {t("ide.blastViz.legendTransitive")}</span>
        <span className="brviz-legend-item"><i className="brviz-dot brviz-dot-1" /> {t("ide.blastViz.legendDistant")}</span>
      </div>
    </div>
  );
}
