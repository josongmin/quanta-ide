import { memo } from "react";
import type { CSSProperties } from "react";
import type { FileNode, Rect, FileEffects, FileLatency } from "@quanta/canvas-engine";
import { elevationFromRisk, EFFECT_STYLE, latencyColor } from "@quanta/canvas-engine";
import { tone } from "@quanta/app-ide/entities/risk";
import type { RiskTone } from "@quanta/app-ide/entities/risk";

interface StreetCardProps {
  file: FileNode;
  rect: Rect;
  isSelected: boolean;
  elevationMode?: boolean;
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
  file, rect, isSelected, elevationMode = false,
  effects, latency, showEffectBadges = true, showLatencyOverlay = false,
  authorTint,
  onSelect,
}: StreetCardProps) {
  const HEADER_H = 32;
  const FOOTER_H = 20;
  const ROW_H    = 22;

  const bodyHeight = rect.h - HEADER_H - FOOTER_H;
  const maxRows    = Math.max(0, Math.floor(bodyHeight / ROW_H));
  const visibleFns = file.functions.slice(0, maxRows);

  const elevation = elevationMode ? elevationFromRisk(file.riskScore) : 0;
  const effectKinds = effects?.effects ?? [];
  const visibleEffects = showEffectBadges ? effectKinds.slice(0, 4) : [];
  const extraEffectCount = Math.max(0, effectKinds.length - visibleEffects.length);
  const latencyTint = showLatencyOverlay && latency
    ? hexFromInt(latencyColor(latency.p95))
    : null;
  const style: CSSProperties = { left: rect.x, top: rect.y, width: rect.w, height: rect.h };
  if (authorTint) {
    // Author tint wins over latency — they'd otherwise fight for the
    // same background slot. Latency overlay keeps its footer glyph.
    style.background = `color-mix(in srgb, ${authorTint} 28%, var(--bg))`;
  } else if (latencyTint) {
    style.background = `color-mix(in srgb, ${latencyTint} 22%, var(--bg))`;
  }
  if (elevation > 0) {
    const ox = elevation * 0.3;
    const oy = elevation * 0.4;
    const blur = elevation * 0.5;
    const sa = Math.min(0.45, elevation / 160);
    style.boxShadow = `${ox}px ${oy}px ${blur}px rgba(0, 0, 0, ${sa})`;
    style.transform = `scale(${1 + elevation / 1000})`;
    style.transformOrigin = "center";
  }

  return (
    <div
      className={`street-card${isSelected ? " street-card--selected" : ""}${elevation > 0 ? " street-card--elevated" : ""}`}
      style={style}
      onClick={() => { onSelect(file.id); }}
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
    prev.elevationMode === next.elevationMode &&
    prev.effects === next.effects &&
    prev.latency === next.latency &&
    prev.showEffectBadges === next.showEffectBadges &&
    prev.showLatencyOverlay === next.showLatencyOverlay &&
    prev.authorTint === next.authorTint &&
    prev.onSelect === next.onSelect,
);
