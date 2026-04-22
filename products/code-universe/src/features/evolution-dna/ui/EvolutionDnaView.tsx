// EvolutionDnaView — per-file DNA strand across commits.
// --------------------------------------------------------------------
// Focus view: if a `building` is selected, render it as a vertical
// "DNA strand" — each commit is a column; each function in the file is
// a horizontal band within the column. Band color = function hash;
// band height = function LoC at that commit (seeded drift so the strand
// mutates over time).
//
// If no file is selected (or selection is not a file): show a hint.

import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  radius,
  space,
} from "../../../shared/ui/tokens";
import {
  commitHistory,
  hashId,
  seeded,
} from "../../../shared/analytics/synth-metrics";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";

export interface EvolutionDnaViewProps {
  ctx: ViewContextValue;
}

// ── Config ────────────────────────────────────────────────────────────

const MIN_FNS = 2;
const MAX_FNS = 8;
const MIN_LOC = 6;
const MAX_LOC = 140;
const DRIFT_STRENGTH = 0.18;  // fraction of LoC that can drift each commit
const MAX_COMMITS = 48;       // cap for rendering
const LANE_W = 22;
const LANE_GAP = 3;
const COL_PAD_Y = 8;

// Fixed hue palette for deterministic function colouring.
const FN_HUES = [8, 30, 48, 170, 200, 230, 270, 320];

// ── Keyframes ─────────────────────────────────────────────────────────

const KF_CSS = `
@keyframes dnav-fadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1);    }
}
@keyframes dnav-bandGrow {
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
}
`;

let _kfInjected = false;
function ensureKeyframes(): void {
  if (_kfInjected || typeof document === "undefined") return;
  _kfInjected = true;
  const el = document.createElement("style");
  el.textContent = KF_CSS;
  document.head.appendChild(el);
}

// ── Function synthesis ────────────────────────────────────────────────

interface SynthFn {
  id: string;
  name: string;
  color: string;
  baseLoc: number;
}

interface CommitSample {
  t: number;
  // LoC per function id — missing key means the function doesn't exist yet.
  locs: Map<string, number>;
}

function synthFns(entityId: string): SynthFn[] {
  const rng = seeded(entityId, "fn-count");
  const n = MIN_FNS + Math.floor(rng() * (MAX_FNS - MIN_FNS + 1));
  const out: SynthFn[] = [];
  for (let i = 0; i < n; i++) {
    const salt = `fn-${i}`;
    const r = seeded(entityId, salt);
    const hue = FN_HUES[hashId(`${entityId}::${salt}`) % FN_HUES.length]!;
    const baseLoc = Math.round(MIN_LOC + r() * (MAX_LOC - MIN_LOC));
    out.push({
      id: salt,
      name: `fn_${i}`,
      color: `hsl(${hue}, 72%, 58%)`,
      baseLoc,
    });
  }
  return out;
}

/** For each commit, decide per-function LoC via deterministic drift.
 *  Some functions appear later / disappear earlier based on seeded timeline. */
function buildTimeline(entity: Entity, commits: number[]): { fns: SynthFn[]; samples: CommitSample[] } {
  const fns = synthFns(entity.id);
  const samples: CommitSample[] = [];

  // Seeded lifespans: each fn has a birth commit index and optional death.
  const spans = fns.map(f => {
    const rng = seeded(entity.id, `${f.id}-span`);
    const birth = Math.floor(rng() * Math.max(1, Math.floor(commits.length * 0.5)));
    const diesEarly = rng() < 0.18;
    const death = diesEarly
      ? birth + Math.max(2, Math.floor(rng() * Math.max(2, commits.length - birth)))
      : commits.length;
    return { birth, death };
  });

  for (let i = 0; i < commits.length; i++) {
    const locs = new Map<string, number>();
    fns.forEach((f, idx) => {
      const span = spans[idx]!;
      if (i < span.birth || i >= span.death) return;
      const rng = seeded(entity.id, `${f.id}-drift-${i}`);
      // Drift relative to base LoC within ±DRIFT_STRENGTH.
      const delta = (rng() * 2 - 1) * DRIFT_STRENGTH * f.baseLoc;
      const loc = Math.max(MIN_LOC, Math.round(f.baseLoc + delta));
      locs.set(f.id, loc);
    });
    samples.push({ t: commits[i]!, locs });
  }
  return { fns, samples };
}

function fmtShortDate(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// ── Main ──────────────────────────────────────────────────────────────

function EvolutionDnaViewImpl({ ctx }: EvolutionDnaViewProps): ReactElement | null {
  ensureKeyframes();

  const selected = useMemo<Entity | null>(() => {
    const id = ctx.selectedId;
    if (!id || !ctx.tree) return null;
    const e = ctx.tree.byId.get(id);
    if (!e || e.kind !== "building") return null;
    return e;
  }, [ctx.selectedId, ctx.tree]);

  const timeline = useMemo(() => {
    if (!selected) return null;
    const commits = commitHistory(selected, 365);
    if (commits.length === 0) return null;
    // Cap to MAX_COMMITS most recent so column width stays readable.
    const trimmed = commits.length > MAX_COMMITS
      ? commits.slice(commits.length - MAX_COMMITS)
      : commits.slice();
    return buildTimeline(selected, trimmed);
  }, [selected]);

  // ── Styles ──────────────────────────────────────────────────────────

  const rootStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    backgroundColor: tokenColor.bg1,
    fontFamily: font.sans,
    animation: `dnav-fadeIn 500ms cubic-bezier(0.22, 1, 0.28, 1) both`,
    overflow: "hidden",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: `${space[3]}px ${space[4]}px`,
    borderBottom: `1px solid ${tokenColor.border}`,
    flexShrink: 0,
  };

  const titleStyle: CSSProperties = {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: tokenColor.text0,
    lineHeight: 1.2,
  };

  const subtitleStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
  };

  // ── Empty / hint ────────────────────────────────────────────────────

  if (!ctx.tree) return null;
  if (!selected) {
    return (
      <div style={rootStyle} role="region" aria-label="Evolution DNA">
        <div style={headerStyle}>
          <span style={titleStyle}>DNA</span>
          <span style={subtitleStyle}>파일의 유전자 서열 · AST × git blame diff</span>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: tokenColor.text2,
            fontSize: font.size.sm,
            textAlign: "center",
            padding: space[4],
          }}
        >
          파일을 선택하면 그 파일의 유전자 서열이 나타납니다.
        </div>
      </div>
    );
  }

  if (!timeline) {
    return (
      <div style={rootStyle} role="region" aria-label="Evolution DNA">
        <div style={headerStyle}>
          <span style={titleStyle}>DNA</span>
          <span style={subtitleStyle}>파일의 유전자 서열 · AST × git blame diff</span>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: tokenColor.text2,
            fontSize: font.size.sm,
            textAlign: "center",
            padding: space[4],
          }}
        >
          이 파일에는 아직 커밋 히스토리가 없습니다.
        </div>
      </div>
    );
  }

  // ── Main DNA render ─────────────────────────────────────────────────

  const { fns, samples } = timeline;

  // Vertical scale: largest total column LoC → max column height.
  let maxTotal = 1;
  for (const s of samples) {
    let total = 0;
    for (const v of s.locs.values()) total += v;
    if (total > maxTotal) maxTotal = total;
  }
  const MAX_COL_H = 320;
  const pxPerLoc = MAX_COL_H / maxTotal;

  const stripStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    padding: `${space[2]}px ${space[4]}px`,
    borderBottom: `1px solid ${tokenColor.border}`,
    backgroundColor: tokenColor.bg2,
    flexShrink: 0,
    fontSize: font.size.xs,
    color: tokenColor.text1,
    flexWrap: "wrap",
  };

  const filenameStyle: CSSProperties = {
    fontFamily: font.mono,
    fontWeight: font.weight.semibold,
    color: tokenColor.text0,
  };

  const dotStyle = (bg: string): CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: bg,
    display: "inline-block",
    marginRight: 4,
    verticalAlign: "middle",
  });

  const strandWrapStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    padding: `${space[4]}px ${space[4]}px`,
  };

  const strandRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "flex-end",
    gap: LANE_GAP,
    minWidth: "fit-content",
  };

  const axisLabelStyle: CSSProperties = {
    marginTop: space[2],
    display: "flex",
    gap: LANE_GAP,
    fontFamily: font.mono,
    fontSize: font.size.xxs,
    color: tokenColor.text3,
    minWidth: "fit-content",
  };

  return (
    <div style={rootStyle} role="region" aria-label="Evolution DNA">
      <div style={headerStyle}>
        <span style={titleStyle}>DNA</span>
        <span style={subtitleStyle}>파일의 유전자 서열 · AST × git blame diff</span>
      </div>

      {/* Summary strip */}
      <div style={stripStyle}>
        <span style={filenameStyle}>{selected.name}</span>
        <span style={{ color: tokenColor.text2 }}>
          {samples.length} commit{samples.length !== 1 ? "s" : ""} · {fns.length} function{fns.length !== 1 ? "s" : ""}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
          {fns.map(f => (
            <span key={f.id} style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: tokenColor.text2 }}>
              <span style={dotStyle(f.color)} />
              {f.name}
            </span>
          ))}
        </span>
      </div>

      {/* Strand */}
      <div style={strandWrapStyle}>
        <div style={strandRowStyle}>
          {samples.map((s, colIdx) => {
            // Stack bands bottom-up for each function that exists in this commit.
            const colH = Math.max(8, Array.from(s.locs.values()).reduce((a, b) => a + b, 0) * pxPerLoc);
            const colStyle: CSSProperties = {
              width: LANE_W,
              height: MAX_COL_H,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              flexShrink: 0,
              borderRadius: radius.xs,
              backgroundColor: tokenColor.bg2,
              padding: `${COL_PAD_Y / 2}px 0`,
              position: "relative",
            };
            const colDelay = colIdx * 14;
            return (
              <div key={colIdx} style={colStyle} title={fmtShortDate(s.t)}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column-reverse",
                    height: colH,
                    width: "100%",
                    transformOrigin: "bottom center",
                    animation: `dnav-bandGrow 420ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                    animationDelay: `${colDelay}ms`,
                  }}
                >
                  {fns.map(f => {
                    const loc = s.locs.get(f.id);
                    if (loc === undefined) return null;
                    const h = Math.max(2, loc * pxPerLoc);
                    const bandStyle: CSSProperties = {
                      width: "100%",
                      height: h,
                      backgroundColor: f.color,
                      opacity: 0.82,
                      borderTop: `1px solid rgba(255,255,255,0.5)`,
                    };
                    return (
                      <div
                        key={f.id}
                        style={bandStyle}
                        aria-label={`${f.name} ${loc} loc at commit ${colIdx}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* X-axis date ticks — every 8th commit */}
        <div style={axisLabelStyle}>
          {samples.map((s, colIdx) => {
            const showLabel = colIdx === 0 || colIdx === samples.length - 1 || colIdx % 8 === 0;
            const labelStyle: CSSProperties = {
              width: LANE_W,
              flexShrink: 0,
              textAlign: "center",
              overflow: "hidden",
              whiteSpace: "nowrap",
              fontSize: font.size.xxs,
              color: tokenColor.text3,
              transform: "rotate(-45deg)",
              transformOrigin: "top left",
              height: 20,
            };
            return (
              <span key={colIdx} style={labelStyle}>
                {showLabel ? fmtShortDate(s.t).slice(5) : ""}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const EvolutionDnaView = memo(EvolutionDnaViewImpl);
