// TimelapseView — commit-timelapse scrubber over a per-file dot grid.
// --------------------------------------------------------------------
// Layout: A scrubber strip at the bottom (range slider covering "6 months
// ago" → "today" in ms) and a grid of dots above — one dot per building
// entity. For each dot, we examine the file's `commitHistory` and
// determine proximity to the current scrubber timestamp (±7 days). Dots
// brighten + swell when "alive" near that timestamp.
//
// Playback: A ▶︎ button toggles auto-scrub via requestAnimationFrame.
// Speed chips switch between 1x / 2x / 4x. When the scrubber reaches
// "now" while playing, it loops back to the start (so demos don't stall).
//
// Animation contract:
//   - Dot pulse: 240ms opacity + scale transition, driven by computed
//     `activation` props (no keyframes needed — React state → style).
//   - Container entrance: 500ms fade + scale 0.96→1.
//   - Scrubber thumb uses the native range input, CSS'd to match.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  radius,
  space,
  transition,
} from "../../../shared/ui/tokens";
import { commitHistory } from "../../../shared/analytics/synth-metrics";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";

// ── Constants ─────────────────────────────────────────────────────────

const WINDOW_MS = 180 * 86_400_000;       // 6 months
const PROX_MS   = 7   * 86_400_000;       // ±7 days "alive" window
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 500;
const DOT_SIZE = 10;
const DOT_GAP  = 6;

export interface TimelapseViewProps {
  ctx: ViewContextValue;
}

interface FileEntry {
  id: string;
  name: string;
  commits: readonly number[];
}

type Speed = 1 | 2 | 4;

// ── Keyframes once ────────────────────────────────────────────────────

const KEYFRAMES_NAME = "tlv-fadeIn";
const KEYFRAMES_CSS = `
@keyframes ${KEYFRAMES_NAME} {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1);    }
}
`;

let _kfInjected = false;
function ensureKeyframes(): void {
  if (_kfInjected || typeof document === "undefined") return;
  _kfInjected = true;
  const el = document.createElement("style");
  el.textContent = KEYFRAMES_CSS;
  document.head.appendChild(el);
}

// ── Helpers ───────────────────────────────────────────────────────────

function fmtDate(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Activation 0..1 — nearest commit within ±PROX_MS; linear falloff. */
function activation(commits: readonly number[], t: number): number {
  if (commits.length === 0) return 0;
  let best = Infinity;
  // Binary search for closest commit since commits is sorted ascending.
  let lo = 0;
  let hi = commits.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = commits[mid]!;
    const d = Math.abs(c - t);
    if (d < best) best = d;
    if (c < t) lo = mid + 1;
    else hi = mid - 1;
  }
  if (best > PROX_MS) return 0;
  return 1 - best / PROX_MS;
}

// ── Main component ────────────────────────────────────────────────────

function TimelapseViewImpl({ ctx }: TimelapseViewProps): ReactElement | null {
  ensureKeyframes();

  const now = useMemo(() => Date.now(), []);
  const minT = now - WINDOW_MS;
  const maxT = now;

  const [t, setT] = useState<number>(minT);
  const [playing, setPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<Speed>(1);

  const files = useMemo<FileEntry[]>(() => {
    if (!ctx.tree) return [];
    const out: FileEntry[] = [];
    for (const e of ctx.tree.byId.values() as Iterable<Entity>) {
      if (e.kind !== "building") continue;
      out.push({
        id: e.id,
        name: e.name,
        commits: commitHistory(e, 200),
      });
    }
    // Stable sort by name for a predictable grid.
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [ctx.tree]);

  // Playback loop via rAF. Advances t by (speed * dt in ms-per-frame * accel).
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      return;
    }
    const step = (ts: number): void => {
      const prev = lastTsRef.current;
      lastTsRef.current = ts;
      const dtMs = prev === null ? 16 : ts - prev;
      // 1x = cover full range in ~20s → 180d / 20_000ms ≈ 778_000 ms-per-ms.
      const msPerFrame = ((WINDOW_MS / 20_000) * dtMs) * speed;
      setT(cur => {
        const next = cur + msPerFrame;
        return next > maxT ? minT : next;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [playing, speed, minT, maxT]);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setT(Number(e.target.value));
  }, []);

  const togglePlay = useCallback(() => setPlaying(p => !p), []);

  // ── Styles ──────────────────────────────────────────────────────────

  const rootStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    backgroundColor: tokenColor.bg1,
    fontFamily: font.sans,
    animation: `${KEYFRAMES_NAME} ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    overflow: "hidden",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space[3],
    padding: `${space[3]}px ${space[4]}px`,
    borderBottom: `1px solid ${tokenColor.border}`,
    flexShrink: 0,
  };

  const titleBlockStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
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

  const dateReadoutStyle: CSSProperties = {
    fontFamily: font.mono,
    fontSize: font.size.sm,
    color: tokenColor.text1,
    fontVariantNumeric: "tabular-nums",
  };

  const gridWrapStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    padding: space[4],
    overflow: "auto",
  };

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fill, minmax(${DOT_SIZE}px, ${DOT_SIZE}px))`,
    gap: DOT_GAP,
    justifyContent: "flex-start",
    alignContent: "flex-start",
  };

  const scrubberWrapStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: space[2],
    padding: `${space[3]}px ${space[4]}px`,
    borderTop: `1px solid ${tokenColor.border}`,
    backgroundColor: tokenColor.bg2,
    flexShrink: 0,
  };

  const scrubberRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[3],
  };

  const playBtnStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 28,
    padding: `0 ${space[3]}px`,
    border: `1px solid ${tokenColor.border}`,
    borderRadius: radius.sm,
    background: tokenColor.bg1,
    color: tokenColor.text0,
    fontFamily: font.sans,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    cursor: "pointer",
    userSelect: "none",
    transition: `background-color ${transition.fast}, border-color ${transition.fast}`,
  };

  const rangeStyle: CSSProperties = {
    flex: 1,
    accentColor: tokenColor.accent,
    cursor: "pointer",
  };

  const endLabelStyle: CSSProperties = {
    fontFamily: font.mono,
    fontSize: font.size.xxs,
    color: tokenColor.text3,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
    userSelect: "none",
  };

  const speedStripStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[1],
  };

  const speedLabelStyle: CSSProperties = {
    fontSize: font.size.xxs,
    color: tokenColor.text3,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginRight: space[1],
  };

  // Empty state ─ no tree yet
  if (!ctx.tree) return null;

  if (files.length === 0) {
    return (
      <div style={rootStyle}>
        <div style={headerStyle}>
          <div style={titleBlockStyle}>
            <span style={titleStyle}>Timelapse</span>
            <span style={subtitleStyle}>커밋 타임랩스 · git log × 파일 활성도</span>
          </div>
        </div>
        <div style={{ ...gridWrapStyle, display: "flex", alignItems: "center", justifyContent: "center", color: tokenColor.text2, fontSize: font.size.sm }}>
          파일이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle} role="region" aria-label="Timelapse">
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleBlockStyle}>
          <span style={titleStyle}>Timelapse</span>
          <span style={subtitleStyle}>커밋 타임랩스 · git log × 파일 활성도</span>
        </div>
        <span style={dateReadoutStyle} aria-live="polite">{fmtDate(t)}</span>
      </div>

      {/* Grid body */}
      <div style={gridWrapStyle}>
        <div style={gridStyle}>
          {files.map(f => {
            const a = activation(f.commits, t);
            const dotStyle: CSSProperties = {
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: radius.pill,
              backgroundColor: tokenColor.accent,
              opacity: 0.08 + a * 0.92,
              transform: `scale(${0.7 + a * 0.8})`,
              transition: `opacity 240ms ${ENTRY_EASE}, transform 240ms ${ENTRY_EASE}`,
              willChange: "transform, opacity",
            };
            return (
              <div
                key={f.id}
                style={dotStyle}
                title={`${f.name} · ${f.commits.length} commits`}
                aria-label={`${f.name} activation ${Math.round(a * 100)}%`}
              />
            );
          })}
        </div>
      </div>

      {/* Scrubber */}
      <div style={scrubberWrapStyle}>
        <div style={scrubberRowStyle}>
          <button
            type="button"
            style={playBtnStyle}
            onClick={togglePlay}
            aria-pressed={playing}
            aria-label={playing ? "Pause" : "Play"}
          >
            <span aria-hidden="true">{playing ? "⏸" : "▶︎"}</span>
            <span>{playing ? "Pause" : "재생"}</span>
          </button>
          <span style={endLabelStyle}>6mo ago</span>
          <input
            type="range"
            min={minT}
            max={maxT}
            step={86_400_000 / 4}  // ¼ day resolution
            value={t}
            onChange={handleScrub}
            style={rangeStyle}
            aria-label="Timelapse scrubber"
          />
          <span style={endLabelStyle}>today</span>
        </div>
        <div style={speedStripStyle}>
          <span style={speedLabelStyle}>Speed</span>
          {[1, 2, 4].map(s => {
            const active = speed === s;
            const chipStyle: CSSProperties = {
              height: 22,
              padding: `0 ${space[2]}px`,
              borderRadius: radius.pill,
              border: `1px solid ${active ? tokenColor.accentBorder : tokenColor.border}`,
              backgroundColor: active ? tokenColor.accentSoft : tokenColor.bg1,
              color: active ? tokenColor.accent : tokenColor.text1,
              fontSize: font.size.xxs,
              fontWeight: font.weight.semibold,
              fontFamily: font.sans,
              cursor: "pointer",
              userSelect: "none",
              transition: `background-color ${transition.fast}, color ${transition.fast}, border-color ${transition.fast}`,
            };
            return (
              <button
                key={s}
                type="button"
                style={chipStyle}
                onClick={() => setSpeed(s as Speed)}
                aria-pressed={active}
              >
                {s}x
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const TimelapseView = memo(TimelapseViewImpl);
