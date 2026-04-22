// HeatRainfallView — "cloud" over dependents; commits drop as rain.
// --------------------------------------------------------------------
// Top third: a cloud shape labelled with the cloud-entity's filename.
// Bottom two-thirds: a grid of dependent files (files that import the
// cloud entity). Raindrops = animated SVG circles falling from cloud to
// target, paced by a synthesized commit stream. On impact, the target
// flashes and its "wet" counter ticks up. Rolling 10-minute rain count
// shown bottom-right.
//
// Animation notes:
//   - Drops are managed as React state; each drop has a birthTime and
//     target index. A single RAF drives time, spawns drops from the
//     commit schedule, and prunes drops older than FALL_MS + FADE_MS.
//   - cy is animated via SVG CSS transition (top → target.y). The
//     drop also has a faint trailing streak for speed feel.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  churn,
  commitHistory,
  hashId,
  seeded,
} from "../../../shared/analytics/synth-metrics";

// ── Animation constants ──────────────────────────────────────────────
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const FALL_MS = 1500;
const FADE_MS = 380;
const DROP_SPAWN_AVG_MS = 900; // mean gap between synthesized commit events
const MAX_LIVE_DROPS = 40;

const KEYFRAMES = `
@keyframes rf-fadeIn {
  from { opacity: 0; transform: translate(0, 6px); }
  to   { opacity: 1; transform: translate(0, 0);   }
}
@keyframes rf-cloudBreathe {
  0%, 100% { opacity: 0.88; transform: scale(1);    }
  50%       { opacity: 1.00; transform: scale(1.015); }
}
@keyframes rf-ripple {
  0%   { r: 0;  opacity: 0.55; }
  100% { r: 14; opacity: 0;    }
}
@keyframes rf-flash {
  0%   { opacity: 0.85; }
  100% { opacity: 0;    }
}
@keyframes rf-puffDrift {
  0%, 100% { transform: translate(0, 0);   }
  50%       { transform: translate(3px, -1px); }
}
`;

// ── Types ────────────────────────────────────────────────────────────
interface Target {
  id: string;
  name: string;
  /** Wet drops received in this session. */
  wet: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Timestamp of most-recent impact (ms) — for flash state. */
  lastHit: number;
}

interface Drop {
  id: number;
  targetIdx: number;
  /** Screen-space X where the drop starts (cloud bottom). */
  startX: number;
  startY: number;
  /** Spawn time (ms from epoch). */
  born: number;
  /** Seconds of fall computed per drop to vary cadence. */
  fallMs: number;
  /** 1..3, modulates stroke width + drop size. */
  weight: number;
}

interface Impact {
  id: number;
  targetIdx: number;
  at: number;
}

// ── Component ────────────────────────────────────────────────────────
function HeatRainfallViewImpl({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  // ── Choose cloud entity ─────────────────────────────────────────
  const { cloud, dependents } = useMemo(() => {
    if (!ctx.tree || !ctx.graph) return { cloud: null as Entity | null, dependents: [] as Entity[] };

    // Prefer the selection if it's a file.
    let cloudEnt: Entity | null = null;
    if (ctx.selectedId) {
      const e = ctx.tree.byId.get(ctx.selectedId);
      if (e && e.kind === "building") cloudEnt = e;
    }
    if (!cloudEnt) {
      // Top-churn fallback.
      let best: { e: Entity; c: number } | null = null;
      for (const e of ctx.tree.byId.values()) {
        if (e.kind !== "building") continue;
        const c = churn(e);
        if (!best || c > best.c) best = { e, c };
      }
      cloudEnt = best?.e ?? null;
    }
    if (!cloudEnt) return { cloud: null, dependents: [] };

    // Dependents = files that import the cloud entity. In graph terms
    // the edge is `from → to`, with `to = cloud` being the importers.
    const deps: Entity[] = [];
    const seen = new Set<string>();
    for (const edge of ctx.graph.fileEdges) {
      if (edge.to === cloudEnt.id && !seen.has(edge.from)) {
        const e = ctx.tree.byId.get(edge.from);
        if (e && e.kind === "building") {
          deps.push(e);
          seen.add(edge.from);
        }
      }
    }
    // If the analyzer hasn't produced file-level edges yet, fall back to
    // an entity-hash neighborhood so the viz has something to show.
    if (deps.length === 0) {
      const buildings: Entity[] = [];
      for (const e of ctx.tree.byId.values()) {
        if (e.kind === "building" && e.id !== cloudEnt.id) buildings.push(e);
      }
      const ordered = buildings
        .map(e => ({ e, h: hashId(`${cloudEnt!.id}::dep::${e.id}`) }))
        .sort((a, b) => a.h - b.h)
        .slice(0, Math.min(24, buildings.length))
        .map(x => x.e);
      return { cloud: cloudEnt, dependents: ordered };
    }
    // Cap at 24 for readability.
    return { cloud: cloudEnt, dependents: deps.slice(0, 24) };
  }, [ctx.tree, ctx.graph, ctx.selectedId]);

  // ── Layout — cloud centred top, grid across bottom ──────────────
  const HEADER_H = 70;
  const CLOUD_H = Math.min(160, Math.max(110, height * 0.24));
  const GRID_PAD_Y = 30;
  const CLOUD_CX = width / 2;
  const CLOUD_CY = HEADER_H + CLOUD_H / 2 + 4;

  const targets = useMemo<Target[]>(() => {
    if (dependents.length === 0) return [];

    const gridTop = HEADER_H + CLOUD_H + GRID_PAD_Y;
    const gridLeft = 24;
    const gridRight = width - 264; // reserve right legend
    const gridBottom = height - 24;
    const gridW = Math.max(200, gridRight - gridLeft);
    const gridH = Math.max(160, gridBottom - gridTop);

    // Auto-grid: aim for roughly square cells.
    const n = dependents.length;
    const aspect = gridW / Math.max(1, gridH);
    const cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
    const rows = Math.max(1, Math.ceil(n / cols));
    const cellW = gridW / cols;
    const cellH = gridH / rows;

    return dependents.map((e, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gridLeft + col * cellW + cellW / 2;
      const y = gridTop + row * cellH + cellH / 2;
      return {
        id: e.id,
        name: e.name,
        wet: 0,
        x,
        y,
        w: Math.max(60, cellW - 10),
        h: Math.max(38, cellH - 10),
        lastHit: 0,
      };
    });
  }, [dependents, width, height, HEADER_H, CLOUD_H]);

  // ── Commit event scheduler ──────────────────────────────────────
  // Use synth `commitHistory` as seed cadence — average gaps become
  // DROP_SPAWN_AVG_MS scaled to "now". Then spawn drops on a live RAF
  // loop (so the panel reads as a live stream).
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const [drops, setDrops] = useState<Drop[]>([]);
  const [impacts, setImpacts] = useState<Impact[]>([]);
  const [rainWindow, setRainWindow] = useState<number[]>([]);
  const [now, setNow] = useState(() => performance.now());

  const nextDropIdRef = useRef(0);
  const nextImpactIdRef = useRef(0);
  const lastSpawnRef = useRef(0);

  const cloudId = cloud?.id ?? "none";
  const rng = useMemo(() => seeded(cloudId, "rain"), [cloudId]);
  const history = useMemo(
    () => (cloud ? commitHistory(cloud, 90) : []),
    [cloud],
  );

  useEffect(() => {
    // Reset on cloud change.
    setDrops([]);
    setImpacts([]);
    setRainWindow([]);
    lastSpawnRef.current = 0;
    nextDropIdRef.current = 0;
    nextImpactIdRef.current = 0;
  }, [cloudId]);

  const historyLen = history.length;

  const spawnDrop = useCallback((t: number) => {
    const tg = targetsRef.current;
    if (tg.length === 0) return;
    const idx = Math.floor(rng() * tg.length);
    const fallMs = FALL_MS + (rng() - 0.5) * 320;
    const jitterX = (rng() - 0.5) * 40;
    const drop: Drop = {
      id: nextDropIdRef.current++,
      targetIdx: idx,
      startX: CLOUD_CX + jitterX,
      startY: CLOUD_CY + CLOUD_H / 2 - 18,
      born: t,
      fallMs,
      weight: 1 + Math.floor(rng() * 3),
    };
    setDrops(prev => {
      const next = [...prev, drop];
      // Cap live drops so a long session stays cheap.
      if (next.length > MAX_LIVE_DROPS) next.splice(0, next.length - MAX_LIVE_DROPS);
      return next;
    });
    // Schedule its impact
    const hitAt = t + fallMs;
    window.setTimeout(() => {
      // Apply impact on the actual target from refs (in case targets change).
      const latest = targetsRef.current;
      const tgt = latest[idx];
      if (!tgt) return;
      tgt.wet += 1;
      tgt.lastHit = performance.now();
      setImpacts(prev => {
        const out = [...prev, { id: nextImpactIdRef.current++, targetIdx: idx, at: hitAt }];
        // Keep impacts list short
        const cutoff = performance.now() - 1200;
        return out.filter(p => p.at > cutoff);
      });
      setRainWindow(prev => {
        const now2 = Date.now();
        const tenMin = 10 * 60 * 1000;
        return [...prev.filter(ts => now2 - ts < tenMin), now2];
      });
    }, fallMs);
  }, [CLOUD_CX, CLOUD_CY, CLOUD_H, rng]);

  useEffect(() => {
    if (!cloud) return;
    let raf = 0;
    const loop = (t: number) => {
      setNow(t);
      // Synth commit cadence: uses churn-scaled inter-arrival time.
      // Higher churn → faster rain.
      const churnBoost = cloud ? Math.max(0.4, churn(cloud)) : 1;
      const gap = DROP_SPAWN_AVG_MS / churnBoost;
      if (t - lastSpawnRef.current > gap * (0.5 + rng())) {
        lastSpawnRef.current = t;
        spawnDrop(t);
      }
      // Prune expired drops
      setDrops(prev => prev.filter(d => t - d.born < d.fallMs + FADE_MS));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cloud, spawnDrop, rng]);

  // ── Render ──────────────────────────────────────────────────────
  if (!cloud) {
    return (
      <div style={emptyStateStyle}>
        <span style={emptyTitleStyle}>No cloud to seed.</span>
        <span style={emptySubtitleStyle}>Select a file or load a workspace graph.</span>
      </div>
    );
  }

  const recentRainCount = rainWindow.length;
  const cloudChurn = churn(cloud);
  const rainIntensity = Math.round(cloudChurn * 100);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <div style={headerStyle}>
        <div style={titleBlockStyle}>
          <span style={titleStyle}>Heat Rainfall</span>
          <span style={subtitleStyle}>
            의존성 강우 — <span style={cloudPathStyle}>{cloud.name}</span> 커밋이 떨어집니다
          </span>
        </div>
      </div>

      <svg
        width={width}
        height={height - HEADER_H}
        viewBox={`0 0 ${width} ${height - HEADER_H}`}
        style={{
          position: "absolute",
          top: HEADER_H,
          left: 0,
          display: "block",
          pointerEvents: "none",
          animation: `rf-fadeIn 520ms ${ENTRY_EASE} both`,
        }}
        role="img"
        aria-label="Heat rainfall"
      >
        <defs>
          {/* Cloud body gradient */}
          <radialGradient id="rf-cloud-grad" cx="50%" cy="40%" r="75%">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity={1} />
            <stop offset="60%"  stopColor="#edf3fb" stopOpacity={1} />
            <stop offset="100%" stopColor="#cdd6e3" stopOpacity={0.9} />
          </radialGradient>
          <linearGradient id="rf-drop-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color.accent} stopOpacity={0.0} />
            <stop offset="60%"  stopColor={color.accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color.accent} stopOpacity={0.95} />
          </linearGradient>
          <filter id="rf-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="3" result="off" />
            <feColorMatrix in="off" type="matrix"
              values="0 0 0 0 0.05  0 0 0 0 0.10  0 0 0 0 0.18  0 0 0 0.10 0" />
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
        </defs>

        {/* ── Cloud ────────────────────────────────────────────── */}
        {(() => {
          const cx = CLOUD_CX;
          const cy = CLOUD_CY - HEADER_H;
          const w = Math.min(420, width * 0.52);
          // Composite cloud = 3 overlapping ellipses with a base underline.
          const puffs = [
            { x: cx - w * 0.28, y: cy + 4,  rx: w * 0.22, ry: w * 0.13 },
            { x: cx,            y: cy - 6,  rx: w * 0.28, ry: w * 0.17 },
            { x: cx + w * 0.26, y: cy + 2,  rx: w * 0.22, ry: w * 0.13 },
            { x: cx - w * 0.08, y: cy + 14, rx: w * 0.24, ry: w * 0.10 },
            { x: cx + w * 0.12, y: cy + 14, rx: w * 0.22, ry: w * 0.10 },
          ];
          return (
            <g
              style={{
                animation: `rf-cloudBreathe 3600ms ease-in-out infinite`,
                transformOrigin: `${cx}px ${cy}px`,
              }}
              filter="url(#rf-shadow)"
            >
              {puffs.map((p, i) => (
                <ellipse
                  key={`puff-${i}`}
                  cx={p.x}
                  cy={p.y}
                  rx={p.rx}
                  ry={p.ry}
                  fill="url(#rf-cloud-grad)"
                  stroke={color.border}
                  strokeWidth={0.7}
                  style={{
                    animation: `rf-puffDrift ${4800 + i * 420}ms ease-in-out infinite`,
                    transformOrigin: `${p.x}px ${p.y}px`,
                  }}
                />
              ))}
              {/* Label on the cloud */}
              <text
                x={cx}
                y={cy - 4}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily={font.mono}
                fontSize={font.size.sm}
                fontWeight={font.weight.semibold}
                fill={color.text0}
                style={{ pointerEvents: "none" }}
              >
                {cloud.name}
              </text>
              <text
                x={cx}
                y={cy + 12}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily={font.sans}
                fontSize={9}
                fill={color.text2}
                letterSpacing="0.14em"
                style={{ pointerEvents: "none" }}
              >
                {rainIntensity}% CHURN
              </text>
            </g>
          );
        })()}

        {/* ── Dependency strings — faint beziers from cloud to each target ─ */}
        {targets.map((t, i) => {
          const cx = CLOUD_CX;
          const cy = CLOUD_CY - HEADER_H + CLOUD_H / 2 - 16;
          const tx = t.x;
          const ty = t.y - HEADER_H - 18;
          const mx = (cx + tx) / 2;
          const my = (cy + ty) / 2 - 30;
          return (
            <path
              key={`str-${t.id}-${i}`}
              d={`M ${cx} ${cy} Q ${mx} ${my} ${tx} ${ty}`}
              fill="none"
              stroke={color.accent}
              strokeWidth={0.8}
              strokeOpacity={0.14}
              strokeDasharray="2 4"
            />
          );
        })}

        {/* ── Raindrops — positioned with a CSS transition on the tilted line. */}
        {drops.map(d => {
          const age = now - d.born;
          const tPct = Math.min(1, age / d.fallMs);
          const target = targets[d.targetIdx];
          if (!target) return null;
          const endX = target.x;
          const endY = target.y - HEADER_H - 18;
          const x = d.startX + (endX - d.startX) * tPct;
          const y = (d.startY - HEADER_H) + (endY - (d.startY - HEADER_H)) * tPct;
          const tailLen = 14 + d.weight * 4;
          const tailDx = (endX - d.startX) * (tailLen / 600);
          const tailDy = tailLen * 0.8;
          const alpha = tPct > 0.9 ? 1 - (tPct - 0.9) / 0.1 : 1;
          return (
            <g key={`drop-${d.id}`} opacity={alpha}>
              <line
                x1={x - tailDx}
                y1={y - tailDy}
                x2={x}
                y2={y}
                stroke="url(#rf-drop-grad)"
                strokeWidth={0.9 + d.weight * 0.2}
                strokeLinecap="round"
              />
              <circle
                cx={x}
                cy={y}
                r={1.2 + d.weight * 0.3}
                fill={color.accent}
                opacity={0.9}
              />
            </g>
          );
        })}

        {/* ── Target cards ─────────────────────────────────────── */}
        {targets.map((t, i) => {
          const flashAge = now - (t.lastHit ? t.lastHit : -9999);
          const isFlashing = t.lastHit > 0 && flashAge < 700;
          const flashOpacity = isFlashing ? Math.max(0, 1 - flashAge / 700) : 0;
          const y = t.y - HEADER_H;
          const wetNorm = Math.min(1, t.wet / 8);
          const fill = `rgba(13, 153, 255, ${0.03 + wetNorm * 0.15})`;
          return (
            <g
              key={t.id}
              style={{
                animation: `rf-fadeIn 520ms ${ENTRY_EASE} ${180 + i * 14}ms both`,
                pointerEvents: "auto",
                cursor: "pointer",
              }}
              onClick={() => ctx.dispatch.selectEntity(t.id)}
            >
              <rect
                x={t.x - t.w / 2}
                y={y - t.h / 2}
                width={t.w}
                height={t.h}
                rx={6}
                fill={fill}
                stroke={color.border}
                strokeWidth={0.8}
              />
              {/* Flash overlay */}
              {isFlashing && (
                <rect
                  x={t.x - t.w / 2}
                  y={y - t.h / 2}
                  width={t.w}
                  height={t.h}
                  rx={6}
                  fill={color.accent}
                  opacity={flashOpacity * 0.22}
                  style={{ pointerEvents: "none" }}
                />
              )}
              <text
                x={t.x}
                y={y - 4}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily={font.mono}
                fontSize={font.size.xs}
                fill={color.text0}
                style={{ pointerEvents: "none" }}
              >
                {t.name.length > 18 ? `${t.name.slice(0, 17)}…` : t.name}
              </text>
              <text
                x={t.x}
                y={y + 9}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily={font.sans}
                fontSize={9}
                fill={color.text3}
                style={{ pointerEvents: "none" }}
              >
                {t.wet} drops
              </text>
            </g>
          );
        })}

        {/* Ripples on impacts */}
        {impacts.map(im => {
          const target = targets[im.targetIdx];
          if (!target) return null;
          const age = now - im.at;
          if (age < 0 || age > 900) return null;
          return (
            <circle
              key={`ripple-${im.id}`}
              cx={target.x}
              cy={target.y - HEADER_H}
              r={2}
              fill="none"
              stroke={color.accent}
              strokeWidth={1.1}
              style={{
                animation: "rf-ripple 900ms ease-out forwards",
              }}
            />
          );
        })}
      </svg>

      {/* Right legend */}
      <div style={legendStyle}>
        <div style={legendSectionStyle}>
          <span style={legendHeadStyle}>Cloud</span>
          <div style={cloudCardStyle}>
            <span style={cloudNameStyle}>{cloud.name}</span>
            <span style={cloudPathStyle2}>{cloud.path}</span>
            <div style={metaRowStyle}>
              <span style={pillStyle}>churn {rainIntensity}%</span>
              <span style={pillStyle}>{targets.length} deps</span>
            </div>
          </div>
        </div>

        <div style={legendSectionStyle}>
          <span style={legendHeadStyle}>Rain (최근 10분)</span>
          <div style={bigCountRowStyle}>
            <span style={bigCountValueStyle}>{recentRainCount}</span>
            <span style={bigCountLabelStyle}>빗방울</span>
          </div>
          <span style={legendCaptionStyle}>
            History: {historyLen} commits (90d)
          </span>
        </div>

        <div style={legendSectionStyle}>
          <span style={legendHeadStyle}>Wettest</span>
          {[...targets].sort((a, b) => b.wet - a.wet).slice(0, 5).map(t => (
            <div key={t.id} style={legendRowStyle}>
              <span style={legendNameStyle}>{t.name}</span>
              <span style={legendCountStyle}>{t.wet}</span>
            </div>
          ))}
        </div>

        <div style={legendFooterStyle}>
          <span style={legendCaptionStyle}>click 카드 → 파일 선택</span>
        </div>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const rootStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  background: color.bg0,
  fontFamily: font.sans,
  color: color.text0,
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: `${space[4]}px ${space[5]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
  flexShrink: 0,
};
const titleBlockStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const titleStyle: CSSProperties = {
  fontSize: font.size.display,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
};
const subtitleStyle: CSSProperties = { fontSize: font.size.sm, color: color.text2 };
const cloudPathStyle: CSSProperties = {
  fontFamily: font.mono,
  color: color.text1,
  background: color.bg3,
  padding: "1px 6px",
  borderRadius: radius.xs,
};

const legendStyle: CSSProperties = {
  position: "absolute",
  right: space[5],
  top: 88,
  width: 240,
  display: "flex",
  flexDirection: "column",
  gap: space[3],
  padding: space[3],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: `rf-fadeIn 520ms ${ENTRY_EASE} 220ms both`,
};
const legendSectionStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const legendHeadStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginBottom: space[1],
};
const legendRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: space[2],
  alignItems: "center",
  padding: `${space[1]}px ${space[2]}px`,
  borderRadius: radius.sm,
};
const legendNameStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const legendCountStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text3,
  fontVariantNumeric: "tabular-nums",
};
const legendCaptionStyle: CSSProperties = { fontSize: font.size.xs, color: color.text3 };
const legendFooterStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  paddingTop: space[2],
  borderTop: `1px solid ${color.border}`,
};

const cloudCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: space[2],
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
};
const cloudNameStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
};
const cloudPathStyle2: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const metaRowStyle: CSSProperties = {
  display: "flex",
  gap: space[1],
  flexWrap: "wrap",
  marginTop: 2,
};
const pillStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  padding: `1px ${space[1]}px`,
  background: color.bg3,
  borderRadius: radius.xs,
  color: color.text2,
};

const bigCountRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: space[2],
};
const bigCountValueStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxl,
  color: color.accent,
  fontWeight: font.weight.semibold,
  fontVariantNumeric: "tabular-nums",
};
const bigCountLabelStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
};

const emptyStateStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: space[2],
  background: color.bg0,
  fontFamily: font.sans,
};
const emptyTitleStyle: CSSProperties = {
  fontSize: font.size.md,
  color: color.text1,
  fontWeight: font.weight.medium,
};
const emptySubtitleStyle: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text3,
};

export const HeatRainfallView = memo(HeatRainfallViewImpl);
