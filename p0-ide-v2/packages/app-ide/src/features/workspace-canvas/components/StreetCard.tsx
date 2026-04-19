import { memo } from "react";
import type { CSSProperties } from "react";
import type { FileNode, Rect, FileEffects, FileLatency } from "@quanta/canvas-engine";
import { EFFECT_STYLE, latencyColor } from "@quanta/canvas-engine";
import { tone } from "@quanta/app-ide/entities/risk";
import type { RiskTone } from "@quanta/app-ide/entities/risk";

interface StreetCardProps {
  file: FileNode;
  rect: Rect;
  isSelected: boolean;
  effects?: FileEffects;
  latency?: FileLatency;
  showEffectBadges?: boolean;
  showLatencyOverlay?: boolean;
  /**
   * Optional background tint hex (`#rrggbb`). Used by
   * temporal.authorFootprint to color the card by dominant author at
   * the active commit. Wins over the latency tint when both are set.
   */
  authorTint?: string;
  onSelect: (id: string) => void;
}

function hexFromInt(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

const TONE_PASTEL: Record<RiskTone, string> = {
  high: "#fca5a5",
  mid: "#fde68a",
  low: "#bbf7d0",
};

function riskColor(score: number): string {
  return TONE_PASTEL[tone(score)];
}

// CPX has its own thresholds (10 / 5) — distinct from risk score buckets,
// so it stays inline rather than using `tone()`.
function cpxColor(cpx: number): string {
  if (cpx >= 10) return TONE_PASTEL.high;
  if (cpx >= 5) return TONE_PASTEL.mid;
  return TONE_PASTEL.low;
}

function StreetCardImpl({
  file, rect, isSelected,
  effects, latency, showEffectBadges = true, showLatencyOverlay = false,
  authorTint,
  onSelect,
}: StreetCardProps) {
  // Street card shows one row per function, so its intrinsic content
  // height is (header + N * row + footer) — which is much smaller than
  // `rect.h` (which the layout now sizes from the file's LOC to fit the
  // Ground card's rendered source). Two consequences:
  //   1. We render *all* functions, not a slice — the rect is always
  //      large enough, the previous `Math.floor(bodyHeight / ROW_H)` cap
  //      only cut rows off when `rect.h` under-provisioned Ground too.
  //   2. We position the card using `rect.{x,y,w}` but let its height be
  //      content-driven (no fixed `height`); a `minHeight` keeps small
  //      cards tappable. Layout slot is reserved at `rect.h` — the empty
  //      space below short Street cards is the visual cost of using one
  //      shared layout across LODs.
  const visibleFns = file.functions;

  const effectKinds = effects?.effects ?? [];
  const visibleEffects = showEffectBadges ? effectKinds.slice(0, 4) : [];
  const extraEffectCount = Math.max(0, effectKinds.length - visibleEffects.length);
  const latencyTint = showLatencyOverlay && latency
    ? hexFromInt(latencyColor(latency.p95))
    : null;
  const style: CSSProperties = { left: rect.x, top: rect.y, width: rect.w, minHeight: 120 };
  // Author tint wins over latency — they'd otherwise fight for the same
  // background slot. Latency overlay keeps its footer glyph. Blend toward
  // white so the card stays crisp when either overlay is active.
  if (authorTint) {
    style.background = `color-mix(in srgb, ${authorTint} 12%, #ffffff)`;
  } else if (latencyTint) {
    style.background = `color-mix(in srgb, ${latencyTint} 10%, #ffffff)`;
  }

  return (
    <div
      className={`street-card${isSelected ? " street-card--selected" : ""}`}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`Select file ${file.name}`}
      aria-pressed={isSelected}
      onClick={() => { onSelect(file.id); }}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(file.id);
        }
      }}
    >
      <div className="street-card__header">
        <span className="street-card__filename" title={file.name}>
          {file.name}
        </span>
        <span
          className="street-card__risk"
          style={{ background: riskColor(file.riskScore) }}
        >
          {file.riskScore}
        </span>
      </div>

      <div className="street-card__fns">
        {visibleFns.map(fn => (
          <div key={fn.name} className="street-card__fn-row">
            <span className="street-card__fn-name" title={fn.name}>
              {fn.name}
            </span>
            <span
              className="street-card__fn-cpx"
              style={{ background: cpxColor(fn.complexity) }}
            >
              {fn.complexity}
            </span>
          </div>
        ))}
      </div>

      <div className="street-card__footer">
        <span className="street-card__loc">{file.loc} LOC</span>
        {latency && (
          <span
            className="street-card__lat"
            style={{ color: hexFromInt(latencyColor(latency.p95)) }}
            title={`p50 ${latency.p50}ms · p95 ${latency.p95}ms · p99 ${latency.p99}ms · ${latency.callCount}/min`}
          >
            {latency.p95}ms
          </span>
        )}
      </div>

      {visibleEffects.length > 0 && (
        <div className="street-card__effects">
          {visibleEffects.map(kind => {
            const s = EFFECT_STYLE[kind];
            return (
              <span
                key={kind}
                className="street-card__effect-chip"
                style={{ background: hexFromInt(s.color) }}
                title={s.description}
              >
                {s.glyph}
              </span>
            );
          })}
          {extraEffectCount > 0 && (
            <span className="street-card__effect-chip street-card__effect-chip--more">
              +{extraEffectCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Custom comparator: visibleScene rebuilds may yield a fresh FileNode object
// even when the file's identity/content is unchanged. Compare by id + rect
// reference + isSelected + onSelect stability so re-renders are strictly tied
// to visible state. (Rect is reference-stable per layout; see layout/types.)
export const StreetCard = memo(
  StreetCardImpl,
  (prev, next) =>
    prev.file.id === next.file.id &&
    prev.file === next.file &&
    prev.rect === next.rect &&
    prev.isSelected === next.isSelected &&
    prev.effects === next.effects &&
    prev.latency === next.latency &&
    prev.showEffectBadges === next.showEffectBadges &&
    prev.showLatencyOverlay === next.showLatencyOverlay &&
    prev.authorTint === next.authorTint &&
    prev.onSelect === next.onSelect,
);
