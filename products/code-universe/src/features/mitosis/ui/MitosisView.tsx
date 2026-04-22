// MitosisView — cellular split visualization for files where two authors
// have closely-matched contributions. Each "cell" pair breathes (slight
// orbital drift) so the overlap stays alive rather than reading as a
// static diagram. The separation distance between the two nuclei maps to
// conflict probability: balanced ownership → wider split → higher risk of
// contention in an upcoming merge.

import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, shadow, transition } from "../../../shared/ui/tokens";
import { authorHue, authorSplit } from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

interface Candidate {
  id: string;
  label: string;
  path: string;
  authorA: string;
  authorB: string;
  shareA: number;
  shareB: number;
  /** 0..1 — higher = more balanced = more conflict risk. */
  conflict: number;
}

const KEYFRAMES = `
@keyframes mit-enter {
  0%   { opacity: 0; transform: scale(0.96); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes mit-cell-a {
  0%, 100% { transform: translate(var(--dx-a), var(--dy-a)); }
  50%      { transform: translate(calc(var(--dx-a) * 1.08), calc(var(--dy-a) * 1.08)); }
}
@keyframes mit-cell-b {
  0%, 100% { transform: translate(var(--dx-b), var(--dy-b)); }
  50%      { transform: translate(calc(var(--dx-b) * 1.08), calc(var(--dy-b) * 1.08)); }
}
`;

function buildCandidates(ctx: ViewContextValue): Candidate[] {
  if (!ctx.tree) return [];
  const out: Candidate[] = [];
  for (const entity of ctx.tree.byId.values()) {
    if (entity.kind !== "building") continue;
    const split = authorSplit(entity);
    if (split.length < 2) continue;
    const a = split[0];
    const b = split[1];
    if (!a || !b) continue;
    const diff = Math.abs(a.share - b.share);
    if (diff > 0.25) continue;
    out.push({
      id: entity.id,
      label: entity.name,
      path: entity.path,
      authorA: a.id,
      authorB: b.id,
      shareA: a.share,
      shareB: b.share,
      conflict: 1 - diff,
    });
  }
  // Highest conflict first.
  out.sort((x, y) => y.conflict - x.conflict);
  return out.slice(0, 48);
}

function MitosisViewImpl({ ctx }: Props) {
  const cells = useMemo(() => buildCandidates(ctx), [ctx]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = useCallback((id: string) => {
    setExpandedId(cur => (cur === id ? null : id));
    ctx.dispatch.selectEntity(id);
  }, [ctx.dispatch]);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    s.dataset.mitosisKeyframes = "1";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  if (cells.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: font.size.md, color: color.text2 }}>
          분열 직전 파일이 없습니다.
        </div>
        <div style={{ marginTop: space[2], fontSize: font.size.xs, color: color.text3 }}>
          두 저자가 비슷한 비율로 기여한 파일이 집계되면 여기에 표시됩니다.
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <div style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>
            Mitosis
          </div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            두 저자의 기여가 근접한 파일 — 갈라질 준비 중인 셀 {cells.length}
          </div>
        </div>
        <Legend />
      </div>

      <div style={gridStyle}>
        {cells.map((cell, i) => (
          <Cell
            key={cell.id}
            cell={cell}
            index={i}
            expanded={expandedId === cell.id}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  );
}

function Cell({
  cell,
  index,
  expanded,
  onToggle,
}: {
  cell: Candidate;
  index: number;
  expanded: boolean;
  onToggle: (id: string) => void;
}) {
  const hueA = authorHue(cell.authorA);
  const hueB = authorHue(cell.authorB);
  // Radius baked from share: the dominant author owns the slightly bigger
  // cell. Keep both nuclei clearly visible — min 16, max 22 px.
  const rA = 16 + cell.shareA * 10;
  const rB = 16 + cell.shareB * 10;
  // Separation ∝ conflict. At conflict=1 (tied 50/50) nuclei sit 0.9*(rA+rB)
  // apart; at 0.75 they mostly overlap. Feels like a cell in anaphase.
  const sep = (rA + rB) * (0.35 + cell.conflict * 0.55);
  const dxA = -sep / 2;
  const dxB = sep / 2;

  return (
    <button
      type="button"
      style={{
        ...cellStyle,
        animationDelay: `${Math.min(index, 40) * 18}ms`,
      }}
      onClick={() => onToggle(cell.id)}
      aria-expanded={expanded}
    >
      <div style={svgFrameStyle}>
        <svg viewBox="-60 -40 120 80" width="100%" height="100%" style={{ display: "block" }}>
          <g style={{
            "--dx-a": `${dxA}px`,
            "--dy-a": "0px",
            animation: "mit-cell-a 3.6s ease-in-out infinite",
            transformOrigin: "0 0",
          } as CSSProperties}>
            <circle cx={0} cy={0} r={rA}
              fill={`hsl(${hueA} 60% 58%)`} fillOpacity={0.18}
              stroke={`hsl(${hueA} 60% 46%)`} strokeWidth={1.1} strokeOpacity={0.75}
            />
            <circle cx={0} cy={0} r={rA * 0.42}
              fill={`hsl(${hueA} 60% 46%)`} fillOpacity={0.55}
            />
          </g>
          <g style={{
            "--dx-b": `${dxB}px`,
            "--dy-b": "0px",
            animation: "mit-cell-b 3.6s ease-in-out infinite",
            transformOrigin: "0 0",
          } as CSSProperties}>
            <circle cx={0} cy={0} r={rB}
              fill={`hsl(${hueB} 60% 58%)`} fillOpacity={0.18}
              stroke={`hsl(${hueB} 60% 46%)`} strokeWidth={1.1} strokeOpacity={0.75}
            />
            <circle cx={0} cy={0} r={rB * 0.42}
              fill={`hsl(${hueB} 60% 46%)`} fillOpacity={0.55}
            />
          </g>
        </svg>
      </div>

      <div style={labelStyle}>
        <div style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.text0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cell.label}
        </div>
        <div style={{ marginTop: 2, fontSize: font.size.xxs, color: color.text2, fontFamily: font.mono }}>
          {cell.authorA} · {Math.round(cell.shareA * 100)}% &nbsp;↔&nbsp; {cell.authorB} · {Math.round(cell.shareB * 100)}%
        </div>
        <div style={{ marginTop: space[1], display: "flex", alignItems: "center", gap: space[1] }}>
          <div style={meterBaseStyle}>
            <div style={{ ...meterFillStyle, width: `${cell.conflict * 100}%` }} />
          </div>
          <span style={{ fontSize: font.size.xxs, color: color.text2, fontVariantNumeric: "tabular-nums" }}>
            {Math.round(cell.conflict * 100)}
          </span>
        </div>
      </div>

      {expanded && <ExpandedTimeline cell={cell} />}
    </button>
  );
}

function ExpandedTimeline({ cell }: { cell: Candidate }) {
  // Interleaved fake commits — one row per author, positions from seeded
  // RNG. Shows visually how their edits are stacking in time.
  const hueA = authorHue(cell.authorA);
  const hueB = authorHue(cell.authorB);
  const dotsA = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < 12; i++) out.push((i * 17 + (hueA % 13)) % 100);
    out.sort((a, b) => a - b);
    return out;
  }, [hueA]);
  const dotsB = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < 12; i++) out.push((i * 23 + (hueB % 11)) % 100);
    out.sort((a, b) => a - b);
    return out;
  }, [hueB]);

  return (
    <div style={timelineStyle} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "grid", gridTemplateRows: "auto auto", rowGap: space[1] }}>
        <TimelineRow dots={dotsA} hue={hueA} label={cell.authorA} />
        <TimelineRow dots={dotsB} hue={hueB} label={cell.authorB} />
      </div>
      <div style={{ marginTop: space[2], fontSize: font.size.xxs, color: color.text3 }}>
        최근 커밋 교차 — 가까울수록 merge conflict 가능성 상승
      </div>
    </div>
  );
}

function TimelineRow({ dots, hue, label }: { dots: number[]; hue: number; label: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "56px 1fr", alignItems: "center", columnGap: space[2] }}>
      <span style={{ fontSize: font.size.xxs, fontFamily: font.mono, color: color.text2 }}>{label}</span>
      <div style={{ position: "relative", height: 12, background: color.bg2, borderRadius: radius.pill }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: radius.pill, overflow: "hidden" }}>
          {dots.map((pct, i) => (
            <div key={i} style={{
              position: "absolute",
              left: `${pct}%`,
              top: 2,
              width: 6,
              height: 8,
              borderRadius: 2,
              background: `hsl(${hue} 60% 46%)`,
              opacity: 0.85,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: space[3], fontSize: font.size.xxs, color: color.text2 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: space[1] }}>
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "hsl(210 60% 58%)", opacity: 0.6 }} />
        저자 A
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: space[1] }}>
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "hsl(340 60% 58%)", opacity: 0.6 }} />
        저자 B
      </span>
      <span style={{ color: color.text3 }}>· 간격 ∝ 충돌 가능성</span>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: "mit-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  marginBottom: space[6],
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: space[4],
};

const cellStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: space[3],
  padding: `${space[4]}px ${space[4]}px ${space[3]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.sm,
  textAlign: "left",
  cursor: "pointer",
  animation: "mit-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  transition: `border-color ${transition.base}, box-shadow ${transition.base}, transform ${transition.base}`,
  outline: "none",
  font: "inherit",
};

const svgFrameStyle: CSSProperties = {
  width: "100%",
  height: 80,
  background: color.bg2,
  borderRadius: radius.sm,
  overflow: "hidden",
};

const labelStyle: CSSProperties = {
  minWidth: 0,
};

const meterBaseStyle: CSSProperties = {
  flex: 1,
  height: 4,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const meterFillStyle: CSSProperties = {
  height: "100%",
  background: `linear-gradient(90deg, ${color.warn}, ${color.danger})`,
  borderRadius: radius.pill,
};

const timelineStyle: CSSProperties = {
  marginTop: space[2],
  padding: space[3],
  background: color.bg2,
  borderRadius: radius.sm,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
  padding: space[7],
};

export const MitosisView = memo(MitosisViewImpl);
