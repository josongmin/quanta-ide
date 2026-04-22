// ChurnSparklineView — file grid, each card inline-shows its 90-day
// commit histogram. Sort controls across top. The sparklines themselves
// use a tiny 12-bar SVG — one bar per week — so the histogram reads at a
// glance at card size without a tooltip.

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import { commitHistory, daysSinceModified, recentCommits } from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

type SortKey = "recent" | "churn" | "dormant" | "name";

interface Row {
  entity: Entity;
  buckets: number[]; // 12 weekly buckets
  total: number;     // commits in the 90d window
  recency: number;   // days since last commit (lower = more recent)
}

const WEEKS = 12;
const WINDOW_DAYS = 90;

const KEYFRAMES = `
@keyframes csv-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes csv-bar   { 0% { transform: scaleY(0); } 100% { transform: scaleY(1); } }
`;

function bucketCommits(entity: Entity): Row {
  const commits = commitHistory(entity, WINDOW_DAYS + 30);
  const now = Date.now();
  const windowStart = now - WINDOW_DAYS * 86400_000;
  const buckets = new Array<number>(WEEKS).fill(0);
  let recent = Infinity;
  for (const t of commits) {
    if (t >= windowStart) {
      const daysAgo = (now - t) / 86400_000;
      if (daysAgo < recent) recent = daysAgo;
      const weekIdx = Math.min(WEEKS - 1, Math.floor(daysAgo / 7));
      // Render oldest on the left, newest on the right.
      buckets[WEEKS - 1 - weekIdx] = (buckets[WEEKS - 1 - weekIdx] ?? 0) + 1;
    }
  }
  const total = buckets.reduce((a, b) => a + b, 0);
  const recency = recent === Infinity ? daysSinceModified(entity) : recent;
  return { entity, buckets, total, recency };
}

function ChurnSparklineViewImpl({ ctx }: Props): ReactElement {
  const [sort, setSort] = useState<SortKey>("recent");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    s.dataset.churnSparklineKeyframes = "1";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const rows = useMemo(() => {
    if (!ctx.tree) return [];
    const all: Row[] = [];
    for (const entity of ctx.tree.byId.values()) {
      if (entity.kind !== "building") continue;
      const r = bucketCommits(entity);
      if (r.total === 0 && recentCommits(entity) === 0) continue;
      all.push(r);
    }
    const filtered = filter
      ? all.filter(r => r.entity.name.toLowerCase().includes(filter.toLowerCase()) || r.entity.path.toLowerCase().includes(filter.toLowerCase()))
      : all;
    switch (sort) {
      case "recent":  filtered.sort((a, b) => a.recency - b.recency); break;
      case "churn":   filtered.sort((a, b) => b.total - a.total); break;
      case "dormant": filtered.sort((a, b) => b.recency - a.recency); break;
      case "name":    filtered.sort((a, b) => a.entity.name.localeCompare(b.entity.name)); break;
    }
    return filtered.slice(0, 120);
  }, [ctx.tree, sort, filter]);

  const maxCommits = useMemo(() => {
    let m = 1;
    for (const r of rows) for (const b of r.buckets) if (b > m) m = b;
    return m;
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: font.size.md, color: color.text2 }}>표시할 파일이 없습니다.</div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>
            Churn Sparkline
          </div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            파일 {rows.length}개 · 주당 1 bar · 총 {WEEKS}주
          </div>
        </div>
        <div style={controlsStyle}>
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="이름 · 경로 필터"
            style={inputStyle}
          />
          <div style={sortStyle}>
            {(["recent", "churn", "dormant", "name"] as SortKey[]).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setSort(k)}
                style={{
                  ...chipStyle,
                  ...(sort === k ? chipActiveStyle : {}),
                }}
              >
                {k === "recent" ? "최근 순" : k === "churn" ? "churn 순" : k === "dormant" ? "오래된 순" : "이름 순"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={gridStyle}>
        {rows.map((r, i) => (
          <Card key={r.entity.id} row={r} maxCommits={maxCommits} index={i} onFocus={() => ctx.dispatch.selectEntity(r.entity.id)} />
        ))}
      </div>
    </div>
  );
}

function Card({ row, maxCommits, index, onFocus }: { row: Row; maxCommits: number; index: number; onFocus: () => void }) {
  const { entity, buckets, total, recency } = row;
  const hot = total >= 12;
  return (
    <button
      type="button"
      style={{
        ...cardStyle,
        animationDelay: `${Math.min(index, 60) * 14}ms`,
      }}
      onClick={onFocus}
    >
      <div style={cardHeadStyle}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={cardNameStyle}>{entity.name}</div>
          <div style={cardPathStyle}>{entity.path.replace("/" + entity.name, "")}</div>
        </div>
        <div style={{ ...cardBadgeStyle, color: hot ? color.danger : color.text1 }}>
          {total}
        </div>
      </div>
      <Sparkline buckets={buckets} max={maxCommits} hot={hot} />
      <div style={cardMetaStyle}>
        <span>최근 {Math.round(recency)}일 전</span>
        <span>주당 평균 {(total / WEEKS).toFixed(1)}</span>
      </div>
    </button>
  );
}

function Sparkline({ buckets, max, hot }: { buckets: number[]; max: number; hot: boolean }) {
  const w = 192;
  const h = 36;
  const gap = 2;
  const barW = (w - gap * (buckets.length - 1)) / buckets.length;
  const tint = hot ? color.danger : color.accent;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <line x1={0} y1={h - 0.5} x2={w} y2={h - 0.5} stroke={color.border} strokeWidth={0.8} />
      {buckets.map((c, i) => {
        const bh = max === 0 ? 0 : Math.max(c === 0 ? 0 : 1.5, (c / max) * (h - 4));
        const x = i * (barW + gap);
        const y = h - bh;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={bh}
            rx={1}
            ry={1}
            fill={c === 0 ? color.bg3 : tint}
            fillOpacity={c === 0 ? 0.8 : 0.22 + (c / max) * 0.6}
            style={{
              transformOrigin: `${x + barW / 2}px ${h}px`,
              animation: `csv-bar 360ms cubic-bezier(0.22, 1, 0.28, 1) both`,
              animationDelay: `${i * 14}ms`,
            }}
          />
        );
      })}
    </svg>
  );
}

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: "csv-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: space[4],
  marginBottom: space[5],
  flexWrap: "wrap",
};

const controlsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
};

const inputStyle: CSSProperties = {
  padding: `${space[2]}px ${space[3]}px`,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  background: color.bg0,
  color: color.text0,
  fontFamily: font.sans,
  fontSize: font.size.sm,
  outline: "none",
  width: 180,
};

const sortStyle: CSSProperties = {
  display: "inline-flex",
  background: color.bg2,
  borderRadius: radius.md,
  padding: 3,
  gap: 2,
};

const chipStyle: CSSProperties = {
  padding: `${space[1]}px ${space[3]}px`,
  border: "none",
  background: "transparent",
  color: color.text2,
  fontSize: font.size.xs,
  fontWeight: font.weight.medium,
  borderRadius: radius.sm,
  cursor: "pointer",
  transition: `background ${transition.base}, color ${transition.base}`,
};

const chipActiveStyle: CSSProperties = {
  background: color.bg0,
  color: color.text0,
  boxShadow: shadow.xs,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: space[3],
};

const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
  animation: "csv-enter 480ms cubic-bezier(0.22, 1, 0.28, 1) both",
  transition: `border-color ${transition.base}, transform ${transition.base}, box-shadow ${transition.base}`,
  outline: "none",
};

const cardHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: space[2],
};

const cardNameStyle: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  color: color.text0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const cardPathStyle: CSSProperties = {
  marginTop: 2,
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const cardBadgeStyle: CSSProperties = {
  fontSize: font.size.sm,
  fontVariantNumeric: "tabular-nums",
  fontWeight: font.weight.semibold,
};

const cardMetaStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: font.size.xxs,
  color: color.text2,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const ChurnSparklineView = memo(ChurnSparklineViewImpl);
