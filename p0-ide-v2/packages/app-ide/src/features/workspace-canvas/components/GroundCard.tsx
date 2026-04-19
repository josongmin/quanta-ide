import { memo, useMemo } from "react";
import type { CSSProperties } from "react";
import type { FileNode, Rect, FileBlame, BlameStripe, FileEffects, FileLatency } from "@quanta/canvas-engine";
import { elevationFromRisk, stripesFromBlame, EFFECT_STYLE, latencyColor } from "@quanta/canvas-engine";
import { useGroundData } from "../hooks/use-ground-data";
import { useSceneStore } from "../store/scene-store";
import { useRenderSettings } from "../store/render-settings-store";
import { useInteractionStore } from "../store/interaction-store";
import { useFeature } from "../store/feature-flags-store";
import { langFromFilename, tokenizeSource } from "../lib/code-highlight";

interface GroundCardProps {
  file: FileNode;
  rect: Rect;
  isSelected: boolean;
  elevationMode?: boolean;
  effects?: FileEffects;
  latency?: FileLatency;
  showEffectBadges?: boolean;
  showLatencyOverlay?: boolean;
  /** See StreetCard — author-footprint tint at the active commit. */
  authorTint?: string;
  onSelect: (id: string) => void;
}

function hexFromInt(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

const GUTTER_NOW = Date.UTC(2026, 3, 17);
const DAY = 86_400_000;

function formatAge(ms: number): string {
  const days = Math.max(0, Math.round(ms / DAY));
  if (days < 1)  return "today";
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.round(days / 7)}w ago`;
  if (days < 730) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

function GroundCardImpl({
  file, rect, isSelected, elevationMode = false,
  effects, latency, showEffectBadges = true, showLatencyOverlay = false,
  authorTint,
  onSelect,
}: GroundCardProps) {
  const { data, loading } = useGroundData(file.id);
  const showBlameGutter = useRenderSettings(s => s.showBlameGutter);
  const blame = useSceneStore(s => s.graph?.blame?.[file.id]);

  // Blame time-travel (temporal.blameTimeTravel)
  // When the user has scrubbed to an older snapshot, rewind the blame
  // gutter to that commit's timestamp: drop entries newer than the
  // snapshot, and re-compute the age ramp from the snapshot's "now".
  const blameTimeTravelOn = useFeature("temporal.blameTimeTravel");
  const temporal = useInteractionStore(s => s.temporal);
  const history = useSceneStore(s => s.graph?.history);
  const snapshotTimestamp = useMemo<number | null>(() => {
    if (!blameTimeTravelOn) return null;
    if (!history || history.snapshots.length === 0) return null;
    const active = temporal.mode === "live" && temporal.snapshotIndex > 0;
    if (!active) return null;
    const snap = history.snapshots[temporal.snapshotIndex];
    return snap ? snap.timestamp : null;
  }, [blameTimeTravelOn, history, temporal.mode, temporal.snapshotIndex]);

  const effectiveBlame = useMemo<FileBlame | undefined>(() => {
    if (!blame) return undefined;
    if (snapshotTimestamp === null) return blame;
    const filtered = blame.entries.filter(e => e.committedAt <= snapshotTimestamp);
    if (filtered.length === blame.entries.length) return blame;
    return { ...blame, entries: filtered };
  }, [blame, snapshotTimestamp]);

  const stripes = useMemo<BlameStripe[]>(() => {
    if (!showBlameGutter || !effectiveBlame) return [];
    const now = snapshotTimestamp ?? GUTTER_NOW;
    return stripesFromBlame(effectiveBlame, now);
  }, [showBlameGutter, effectiveBlame, snapshotTimestamp]);

  // Syntax highlighting — memoise per (source, filename) so pans, hovers,
  // and blame-gutter flips don't re-tokenise. Language is picked from the
  // file extension; unknown extensions degrade to plain-text tokens.
  const highlightedLines = useMemo(() => {
    if (!data?.source) return null;
    const lang = langFromFilename(file.name);
    return tokenizeSource(data.source, lang);
  }, [data?.source, file.name]);

  const elevation = elevationMode ? elevationFromRisk(file.riskScore) : 0;
  const effectKinds = effects?.effects ?? [];
  const visibleEffects = showEffectBadges ? effectKinds.slice(0, 5) : [];
  const extraEffectCount = Math.max(0, effectKinds.length - visibleEffects.length);
  const latencyTint = showLatencyOverlay && latency
    ? hexFromInt(latencyColor(latency.p95))
    : null;
  // Use `minHeight` (not `height`): `rect.h` is computed by the layout pass
  // and is authoritative for layout planning, but the user has asked for the
  // full source to be visible even when it overflows the allocated height.
  // Making the rect height a *minimum* lets the card grow vertically with its
  // content; horizontal scroll inside `.ground-card__source` keeps long lines
  // from widening the card. When the layout tier later sizes cards from real
  // line counts, the two converge and `minHeight` becomes a no-op.
  const style: CSSProperties = { left: rect.x, top: rect.y, width: rect.w, minHeight: rect.h };
  // Author / latency tints blend toward white (not `var(--bg)`) so cards
  // stay crisp even when a tint is active — previous 24% / 18% blends
  // against a non-white `--bg` made the whole card look faded.
  if (authorTint) {
    style.background = `color-mix(in srgb, ${authorTint} 10%, #ffffff)`;
  } else if (latencyTint) {
    style.background = `color-mix(in srgb, ${latencyTint} 8%, #ffffff)`;
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
      className={`ground-card${isSelected ? " ground-card--selected" : ""}${elevation > 0 ? " ground-card--elevated" : ""}`}
      style={style}
      onClick={() => { onSelect(file.id); }}
    >
      <div className="ground-card__header">
        <span className="ground-card__filename">{file.name}</span>
        <span className="ground-card__loc">
          {latency && (
            <span
              style={{ color: hexFromInt(latencyColor(latency.p95)), marginRight: 8 }}
              title={`p50 ${latency.p50}ms · p95 ${latency.p95}ms · p99 ${latency.p99}ms · ${latency.callCount}/min`}
            >
              {latency.p95}ms
            </span>
          )}
          {file.loc} LOC
        </span>
      </div>

      {visibleEffects.length > 0 && (
        <div className="ground-card__effects">
          {visibleEffects.map(kind => {
            const s = EFFECT_STYLE[kind];
            return (
              <span
                key={kind}
                className="ground-card__effect-chip"
                style={{ background: hexFromInt(s.color) }}
                title={s.description}
              >
                {s.glyph}
              </span>
            );
          })}
          {extraEffectCount > 0 && (
            <span className="ground-card__effect-chip ground-card__effect-chip--more">
              +{extraEffectCount}
            </span>
          )}
        </div>
      )}

      <div className="ground-card__body">
        {stripes.length > 0 && effectiveBlame && (
          <BlameGutter stripes={stripes} lineCount={effectiveBlame.lineCount} entries={effectiveBlame} />
        )}
        {loading && (
          <div className="ground-card__placeholder">Loading…</div>
        )}
        {!loading && !data?.source && (
          <div className="ground-card__placeholder">—</div>
        )}
        {!loading && data?.source && (
          <pre className="ground-card__source">
            {highlightedLines
              ? highlightedLines.map((line, i) => (
                  <div key={i} className="ground-card__line">
                    {line.map(([cls, text], j) => (
                      <span key={j} className={`hl hl--${cls}`}>{text}</span>
                    ))}
                  </div>
                ))
              : data.source}
          </pre>
        )}
      </div>
    </div>
  );
}

interface BlameGutterProps {
  stripes: readonly BlameStripe[];
  lineCount: number;
  entries: FileBlame;
}

// SVG + absolute-positioned layer — one rect per stripe (O(N_stripes),
// not O(N_lines)) plus per-stripe <title> so native tooltip surfaces
// author · age · message without an extra portal.
function BlameGutter({ stripes, lineCount, entries }: BlameGutterProps) {
  const denom = Math.max(1, lineCount);
  const byStart = useMemo(() => {
    const m = new Map<number, (typeof entries)["entries"][number]>();
    for (const e of entries.entries) m.set(e.startLine, e);
    return m;
  }, [entries]);

  return (
    <svg
      className="ground-card__blame-gutter"
      preserveAspectRatio="none"
      viewBox={`0 0 1 ${denom}`}
    >
      {stripes.map((s, i) => {
        const h = Math.max(1, s.toLine - s.fromLine + 1);
        const rep = byStart.get(s.fromLine);
        const tooltip = rep
          ? `${rep.author} · ${formatAge(s.age)}${rep.message ? " · " + rep.message : ""}`
          : formatAge(s.age);
        return (
          <rect
            key={`${s.fromLine}-${s.toLine}-${i}`}
            x={0}
            y={s.fromLine - 1}
            width={1}
            height={h}
            fill={`#${s.color.toString(16).padStart(6, "0")}`}
          >
            <title>{tooltip}</title>
          </rect>
        );
      })}
    </svg>
  );
}

// See StreetCard: same strategy. Ground cards are heavier (render source code)
// so blocking irrelevant re-renders is particularly important here.
export const GroundCard = memo(
  GroundCardImpl,
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
