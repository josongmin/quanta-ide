// DitView — Depth of Inheritance distribution.
// Histogram + top-N deepest classes. DIT > 5 flagged as concerning.
// Reference: Chidamber & Kemerer, IEEE TSE 1994.

import { memo, useMemo, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import { depthOfInheritance } from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

interface Row {
  entity: Entity;
  dit: number;
}

const KEYFRAMES = `
@keyframes dit-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes dit-bar  { from { transform: scaleY(0); } to { transform: scaleY(1); } }
`;

function collect(ctx: ViewContextValue) {
  if (!ctx.tree) return null;
  const rows: Row[] = [];
  for (const e of ctx.tree.byId.values()) {
    if (e.kind !== "building") continue;
    rows.push({ entity: e, dit: depthOfInheritance(e) });
  }
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.dit - a.dit);

  const maxDit = Math.max(...rows.map(r => r.dit));
  const histogram: number[] = new Array(Math.max(maxDit, 8) + 1).fill(0);
  for (const r of rows) histogram[r.dit] = (histogram[r.dit] ?? 0) + 1;

  const avg = rows.reduce((a, r) => a + r.dit, 0) / rows.length;
  const deep = rows.filter(r => r.dit >= 6).length;
  const veryDeep = rows.filter(r => r.dit >= 8).length;

  return {
    rows,
    histogram,
    avg,
    deep,
    veryDeep,
    maxDit,
    total: rows.length,
  };
}

function DitViewImpl({ ctx }: Props): ReactElement | null {
  const data = useMemo(() => collect(ctx), [ctx]);

  if (!data) {
    return <div style={emptyStyle}><div style={{ fontSize: font.size.md, color: color.text2 }}>데이터 없음</div></div>;
  }

  const maxBucket = Math.max(...data.histogram);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={{ marginBottom: space[5] }}>
        <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>Depth of Inheritance</div>
        <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
          Chidamber & Kemerer · 클래스 {data.total}개 측정
        </div>
      </header>

      <div style={statRow}>
        <StatCard label="평균 DIT" value={data.avg.toFixed(2)} tint={color.text0} />
        <StatCard label="최대 DIT" value={`${data.maxDit}`} tint={data.maxDit >= 8 ? color.danger : color.text0} />
        <StatCard label="DIT ≥ 6" value={`${data.deep}`} sub={`${Math.round((data.deep / data.total) * 100)}%`} tint={data.deep > 0 ? color.warn : color.text0} />
        <StatCard label="DIT ≥ 8 (위험)" value={`${data.veryDeep}`} sub={`${Math.round((data.veryDeep / data.total) * 100)}%`} tint={data.veryDeep > 0 ? color.danger : color.text0} />
      </div>

      <section style={{ marginTop: space[5] }}>
        <h3 style={sectionHead}>분포</h3>
        <div style={histStyle}>
          {data.histogram.map((count, dit) => {
            if (dit === 0) return null;
            const h = maxBucket === 0 ? 0 : (count / maxBucket) * 140;
            const tint = dit >= 8 ? color.danger : dit >= 6 ? color.warn : dit >= 4 ? "#7db843" : color.success;
            return (
              <div key={dit} style={histCol}>
                <span style={{
                  fontSize: font.size.xxs,
                  color: color.text3,
                  fontFamily: font.mono,
                  fontVariantNumeric: "tabular-nums",
                  minHeight: 14,
                }}>
                  {count > 0 ? count : ""}
                </span>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                  <div style={{
                    width: "100%",
                    height: h,
                    background: tint,
                    opacity: count > 0 ? 0.85 : 0.15,
                    borderRadius: `${radius.sm}px ${radius.sm}px 0 0`,
                    transformOrigin: "bottom center",
                    animation: `dit-bar 640ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                    animationDelay: `${dit * 30}ms`,
                    minHeight: count > 0 ? 2 : 0,
                  }} />
                </div>
                <span style={{
                  marginTop: space[1],
                  fontSize: font.size.xxs,
                  color: color.text2,
                  fontFamily: font.mono,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: font.weight.semibold,
                }}>
                  {dit}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: space[2], fontSize: font.size.xxs, color: color.text3, textAlign: "center" }}>
          ← DIT 값 (depth) →
        </div>
      </section>

      <section style={{ marginTop: space[6] }}>
        <h3 style={sectionHead}>상위 20 · 상속 깊은 클래스</h3>
        <div style={listStyle}>
          {data.rows.slice(0, 20).map((r, i) => (
            <DeepRow key={r.entity.id} row={r} index={i} onFocus={() => ctx.dispatch.selectEntity(r.entity.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, sub, tint }: { label: string; value: string; sub?: string; tint: string }) {
  return (
    <div style={statCardStyle}>
      <div style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", fontWeight: font.weight.semibold }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: font.size.xxl, fontFamily: font.mono, fontWeight: font.weight.bold, color: tint, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub ? <div style={{ marginTop: 4, fontSize: font.size.xxs, color: color.text3 }}>{sub}</div> : null}
    </div>
  );
}

function DeepRow({ row, index, onFocus }: { row: Row; index: number; onFocus: () => void }) {
  const tint = row.dit >= 8 ? color.danger : row.dit >= 6 ? color.warn : color.text1;
  return (
    <button
      type="button"
      onClick={onFocus}
      style={{
        ...rowStyle,
        animationDelay: `${Math.min(index, 20) * 14}ms`,
      }}
    >
      <span style={{
        width: 32, height: 32, borderRadius: radius.sm,
        background: `${tint}18`,
        color: tint,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: font.mono, fontSize: font.size.sm, fontWeight: font.weight.bold,
        flexShrink: 0,
        fontVariantNumeric: "tabular-nums",
      }}>
        {row.dit}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: font.size.sm, color: color.text0, fontWeight: font.weight.medium, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.entity.name}
        </span>
        <span style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.entity.path}
        </span>
      </span>
      {row.dit >= 6 && (
        <span style={{
          padding: `2px ${space[2]}px`,
          borderRadius: radius.pill,
          background: `${tint}18`,
          color: tint,
          fontSize: font.size.xxs,
          fontWeight: font.weight.semibold,
          flexShrink: 0,
        }}>
          {row.dit >= 8 ? "위험" : "주의"}
        </span>
      )}
    </button>
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
  animation: "dit-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const statRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: space[3],
};

const statCardStyle: CSSProperties = {
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const histStyle: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: 4,
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  height: 200,
};

const histCol: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
};

const sectionHead: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  margin: 0,
  marginBottom: space[3],
  fontWeight: font.weight.semibold,
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${color.border}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: "dit-enter 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const DitView = memo(DitViewImpl);
