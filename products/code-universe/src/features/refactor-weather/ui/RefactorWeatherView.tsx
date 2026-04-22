// RefactorWeatherView — per-package weather dashboard. Each package
// tile shows: condition icon (sun / partly cloudy / rain / storm), name,
// 3-metric row (complexity / coupling / churn), and a drifting cloud
// background whose speed reflects instability. Click opens a small
// "forecast" card with the package's top-5 worst files.

import { memo, useMemo, useState, useEffect, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import { churn, complexity, fanIn, fanOut } from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

type Condition = "sunny" | "cloudy" | "rain" | "storm";

interface PackageForecast {
  id: string;
  name: string;
  files: Entity[];
  complexity: number; // 0..1
  coupling: number;   // 0..1
  churn: number;      // 0..1
  risk: number;       // 0..1 — weighted sum
  condition: Condition;
}

const CONDITION_ORDER: Record<Condition, number> = { sunny: 0, cloudy: 1, rain: 2, storm: 3 };
const CONDITION_LABEL: Record<Condition, string> = {
  sunny: "맑음",
  cloudy: "흐림",
  rain:   "비",
  storm:  "폭풍",
};

const KEYFRAMES = `
@keyframes rw-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes rw-drift { 0% { transform: translateX(-20%); } 100% { transform: translateX(100%); } }
@keyframes rw-rain  { 0% { transform: translateY(-6px); opacity: 0.6; } 100% { transform: translateY(22px); opacity: 0; } }
@keyframes rw-bolt  { 0%, 100% { opacity: 0; } 10%, 14% { opacity: 0.9; } }
`;

function conditionOf(risk: number): Condition {
  if (risk > 0.72) return "storm";
  if (risk > 0.50) return "rain";
  if (risk > 0.28) return "cloudy";
  return "sunny";
}

function conditionColor(c: Condition): string {
  switch (c) {
    case "sunny":  return color.success;
    case "cloudy": return color.text2;
    case "rain":   return color.accent;
    case "storm":  return color.danger;
  }
}

function buildForecast(ctx: ViewContextValue): PackageForecast[] {
  if (!ctx.tree) return [];
  const edges = ctx.graph?.fileEdges;

  const pkgs: Entity[] = [];
  for (const e of ctx.tree.byId.values()) {
    if (e.kind === "galaxy" || e.kind === "street") pkgs.push(e);
  }

  const out: PackageForecast[] = [];
  for (const p of pkgs) {
    const files: Entity[] = [];
    const stack = [p.id];
    while (stack.length > 0) {
      const id = stack.pop()!;
      const node = ctx.tree.byId.get(id);
      if (!node) continue;
      if (node.kind === "building") files.push(node);
      stack.push(...node.childIds);
    }
    if (files.length === 0) continue;

    let cx = 0, cop = 0, ch = 0;
    for (const f of files) {
      cx += complexity(f);
      cop += Math.min(1, (fanIn(f, edges) + fanOut(f, edges)) / 40);
      ch += churn(f);
    }
    cx /= files.length;
    cop /= files.length;
    ch /= files.length;
    const risk = Math.min(1, cx * 0.4 + cop * 0.3 + ch * 0.3);
    out.push({
      id: p.id,
      name: p.name,
      files,
      complexity: cx,
      coupling: cop,
      churn: ch,
      risk,
      condition: conditionOf(risk),
    });
  }
  // Worst weather first.
  out.sort((a, b) => CONDITION_ORDER[b.condition] - CONDITION_ORDER[a.condition] || b.risk - a.risk);
  return out.slice(0, 36);
}

function RefactorWeatherViewImpl({ ctx }: Props): ReactElement {
  const forecasts = useMemo(() => buildForecast(ctx), [ctx]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    s.dataset.refactorWeatherKeyframes = "1";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  if (forecasts.length === 0) {
    return <div style={emptyStyle}><div style={{ color: color.text2, fontSize: font.size.md }}>패키지 정보가 없습니다.</div></div>;
  }

  const climate = forecasts.reduce((a, f) => a + f.risk, 0) / forecasts.length;
  const climateCondition = conditionOf(climate);

  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>
            Refactor Weather
          </div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            패키지 {forecasts.length}개 · 전체 예보 <strong style={{ color: conditionColor(climateCondition) }}>{CONDITION_LABEL[climateCondition]}</strong>
          </div>
        </div>
        <Legend />
      </header>

      <div style={gridStyle}>
        {forecasts.map((f, i) => (
          <Tile
            key={f.id}
            forecast={f}
            index={i}
            open={openId === f.id}
            onToggle={() => setOpenId(cur => cur === f.id ? null : f.id)}
            onFocusFile={(id) => ctx.dispatch.selectEntity(id)}
          />
        ))}
      </div>
    </div>
  );
}

function Tile({ forecast, index, open, onToggle, onFocusFile }: {
  forecast: PackageForecast;
  index: number;
  open: boolean;
  onToggle: () => void;
  onFocusFile: (id: string) => void;
}) {
  const c = forecast.condition;
  const tint = conditionColor(c);
  // Rain uses the accent-softer wash (token-backed) to read as "cool wet".
  // Storm stays on the neutral bg3 surface — we already paint a tinted
  // border and the falling-rain SVG carries the danger signal.
  const bgTint = c === "sunny" ? color.bg1 : c === "cloudy" ? color.bg2 : c === "rain" ? color.accentSofter : color.bg3;

  const worstFiles = useMemo(() => {
    const arr = [...forecast.files];
    arr.sort((a, b) => complexity(b) + churn(b) - (complexity(a) + churn(a)));
    return arr.slice(0, 5);
  }, [forecast.files]);

  return (
    <div style={{
      ...tileStyle,
      background: bgTint,
      borderColor: open ? tint : color.border,
      animationDelay: `${Math.min(index, 40) * 18}ms`,
    }}>
      <button type="button" onClick={onToggle} style={tileButtonStyle}>
        <Atmosphere condition={c} tint={tint} />
        <div style={tileHeadStyle}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.text0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{forecast.name}</div>
            <div style={{ fontSize: font.size.xxs, color: color.text2, marginTop: 2 }}>{forecast.files.length} files · 위험도 {Math.round(forecast.risk * 100)}</div>
          </div>
          <WeatherIcon condition={c} tint={tint} />
        </div>
        <div style={metricsRowStyle}>
          <Metric label="복잡도" value={forecast.complexity} tint={tint} />
          <Metric label="결합도" value={forecast.coupling} tint={tint} />
          <Metric label="churn" value={forecast.churn} tint={tint} />
        </div>
      </button>
      {open && (
        <div style={detailStyle}>
          <div style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", marginBottom: space[2] }}>
            폭풍의 중심
          </div>
          {worstFiles.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={e => { e.stopPropagation(); onFocusFile(f.id); }}
              style={fileRowStyle}
            >
              <span style={{ fontSize: font.size.xs, fontWeight: font.weight.medium, color: color.text0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              <span style={{ fontSize: font.size.xxs, color: color.text2, fontVariantNumeric: "tabular-nums" }}>
                cx {(complexity(f) * 100).toFixed(0)} · ch {(churn(f) * 100).toFixed(0)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Atmosphere({ condition, tint }: { condition: Condition; tint: string }) {
  const drift = condition === "storm" ? 8 : condition === "rain" ? 14 : condition === "cloudy" ? 24 : 40;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: radius.md }}>
      <svg width="100%" height="100%" viewBox="0 0 200 80" preserveAspectRatio="xMidYMid slice" style={{ display: "block", position: "absolute", inset: 0 }}>
        <g style={{ animation: `rw-drift ${drift}s linear infinite`, transformOrigin: "0 0" }}>
          {condition !== "sunny" && (
            <>
              <ellipse cx={30} cy={20} rx={22} ry={8} fill={tint} opacity={0.08} />
              <ellipse cx={90} cy={30} rx={30} ry={10} fill={tint} opacity={0.06} />
              <ellipse cx={150} cy={18} rx={24} ry={9} fill={tint} opacity={0.07} />
            </>
          )}
        </g>
        {(condition === "rain" || condition === "storm") && (
          <g opacity={0.5}>
            {Array.from({ length: condition === "storm" ? 14 : 8 }, (_, i) => {
              const x = 10 + i * 16 + (i % 2) * 4;
              return (
                <line
                  key={i}
                  x1={x} y1={24} x2={x - 2} y2={36}
                  stroke={tint}
                  strokeWidth={0.8}
                  style={{
                    animation: `rw-rain 1.1s linear infinite`,
                    animationDelay: `${(i % 5) * 0.22}s`,
                  }}
                />
              );
            })}
          </g>
        )}
        {condition === "storm" && (
          <path
            d="M98 16 L102 28 L96 28 L106 44"
            fill="none"
            stroke={tint}
            strokeWidth={1.4}
            opacity={0.9}
            style={{ animation: `rw-bolt 3.4s ease-in-out infinite` }}
          />
        )}
      </svg>
    </div>
  );
}

function WeatherIcon({ condition, tint }: { condition: Condition; tint: string }) {
  return (
    <svg width={30} height={30} viewBox="0 0 30 30" style={{ flexShrink: 0 }}>
      {condition === "sunny" && (
        <>
          <circle cx={15} cy={15} r={6} fill={tint} opacity={0.25} />
          <circle cx={15} cy={15} r={4} fill={tint} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            const x1 = 15 + Math.cos(a) * 7;
            const y1 = 15 + Math.sin(a) * 7;
            const x2 = 15 + Math.cos(a) * 11;
            const y2 = 15 + Math.sin(a) * 11;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={tint} strokeWidth={1.2} />;
          })}
        </>
      )}
      {condition === "cloudy" && (
        <>
          <ellipse cx={12} cy={17} rx={8} ry={4} fill={tint} opacity={0.3} />
          <ellipse cx={18} cy={14} rx={7} ry={5} fill={tint} opacity={0.5} />
        </>
      )}
      {condition === "rain" && (
        <>
          <ellipse cx={12} cy={13} rx={8} ry={4} fill={tint} opacity={0.3} />
          <ellipse cx={18} cy={10} rx={7} ry={5} fill={tint} opacity={0.5} />
          <line x1={10} y1={19} x2={9} y2={25} stroke={tint} strokeWidth={1.3} />
          <line x1={15} y1={19} x2={14} y2={25} stroke={tint} strokeWidth={1.3} />
          <line x1={20} y1={19} x2={19} y2={25} stroke={tint} strokeWidth={1.3} />
        </>
      )}
      {condition === "storm" && (
        <>
          <ellipse cx={12} cy={12} rx={8} ry={4} fill={tint} opacity={0.3} />
          <ellipse cx={18} cy={9} rx={7} ry={5} fill={tint} opacity={0.5} />
          <path d="M14 16 L17 22 L14 22 L18 28" fill="none" stroke={tint} strokeWidth={1.4} />
        </>
      )}
    </svg>
  );
}

function Metric({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.wide }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: space[1], marginTop: 2 }}>
        <div style={{ flex: 1, height: 3, background: color.bg3, borderRadius: radius.pill, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${value * 100}%`, background: tint, opacity: 0.8 }} />
        </div>
        <span style={{ fontVariantNumeric: "tabular-nums", fontSize: font.size.xxs, color: color.text1, fontWeight: font.weight.medium }}>{Math.round(value * 100)}</span>
      </div>
    </div>
  );
}

function Legend() {
  const conds: Condition[] = ["sunny", "cloudy", "rain", "storm"];
  return (
    <div style={{ display: "flex", gap: space[3], fontSize: font.size.xxs, color: color.text2 }}>
      {conds.map(c => (
        <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: space[1] }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: conditionColor(c), opacity: 0.7 }} />
          {CONDITION_LABEL[c]}
        </span>
      ))}
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
  animation: "rw-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  marginBottom: space[5],
  flexWrap: "wrap",
  gap: space[3],
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: space[3],
};

const tileStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
  boxShadow: shadow.xs,
  animation: "rw-enter 480ms cubic-bezier(0.22, 1, 0.28, 1) both",
  transition: `border-color ${transition.base}, transform ${transition.base}`,
};

const tileButtonStyle: CSSProperties = {
  position: "relative",
  textAlign: "left",
  background: "transparent",
  border: "none",
  padding: space[4],
  cursor: "pointer",
  font: "inherit",
};

const tileHeadStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "flex-start",
  gap: space[2],
  marginBottom: space[3],
  zIndex: 1,
};

const metricsRowStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  gap: space[3],
  zIndex: 1,
};

const detailStyle: CSSProperties = {
  padding: `${space[3]}px ${space[4]}px ${space[4]}px`,
  borderTop: `1px solid ${color.border}`,
  background: color.bg0,
};

const fileRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  width: "100%",
  padding: `${space[1]}px ${space[2]}px`,
  background: "transparent",
  border: "none",
  borderRadius: radius.sm,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const RefactorWeatherView = memo(RefactorWeatherViewImpl);
