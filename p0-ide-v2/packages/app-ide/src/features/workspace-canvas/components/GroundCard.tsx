import { memo, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import type { FileNode, Rect, FileBlame, BlameStripe, FileEffects, FileLatency } from "@quanta/canvas-engine";
import { stripesFromBlame, EFFECT_STYLE, latencyColor } from "@quanta/canvas-engine";
import { useGroundData } from "../hooks/use-ground-data";
import { useSceneStore } from "../store/scene-store";
import { useRenderSettings } from "../store/render-settings-store";
import { useInteractionStore } from "../store/interaction-store";
import { useFeature } from "../store/feature-flags-store";
import { langFromFilename, tokenizeSource } from "../lib/code-highlight";
import {
  inlineEditorStore,
  useInlineEditorStore,
} from "../store/inline-editor-store";
import { useEditRippleStore } from "../store/edit-ripple-store";
import { InlineCodeEditor } from "./inline-editor/InlineCodeEditor";

interface GroundCardProps {
  file: FileNode;
  rect: Rect;
  isSelected: boolean;
  effects?: FileEffects;
  latency?: FileLatency;
  showEffectBadges?: boolean;
  showLatencyOverlay?: boolean;
  /** See StreetCard — author-footprint tint at the active commit. */
  authorTint?: string;
  onSelect: (id: string) => void;
  /** See StreetCard — node hover symmetry across LOD tiers. */
  onHover?: (id: string | null) => void;
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
  file, rect, isSelected,
  effects, latency, showEffectBadges = true, showLatencyOverlay = false,
  authorTint,
  onSelect,
  onHover,
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

  // Inline-edit mode — owned by inlineEditorStore so multiple UI surfaces
  // (canvas keybind, card dbl-click, command palette) can enter/exit
  // through the same source of truth.
  const isEditing = useInlineEditorStore(s => s.editingFileId === file.id);
  const isDirty = useInlineEditorStore(s => !!s.dirtyByFileId[file.id]);

  // Multi-file edit ripple — when an AI edit on a neighbour lands, this
  // card briefly pulses so the user sees the change propagate across
  // the graph. Selector intentionally lean: one boolean read + set lookup.
  const isRippling = useEditRippleStore(s => s.affectedFileIds.has(file.id));
  const isRippleSource = useEditRippleStore(s => s.sourceFileId === file.id);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!data?.source) return;
    e.stopPropagation();
    inlineEditorStore.beginEdit(file.id, data.source);
  }, [data?.source, file.id]);

  const handleExitEdit = useCallback(() => {
    inlineEditorStore.endEdit();
  }, []);

  const effectKinds = effects?.effects ?? [];
  const visibleEffects = showEffectBadges ? effectKinds.slice(0, 5) : [];
  const extraEffectCount = Math.max(0, effectKinds.length - visibleEffects.length);
  const latencyTint = showLatencyOverlay && latency
    ? hexFromInt(latencyColor(latency.p95))
    : null;
  // Hard `height` (not `minHeight`) — cards are capped at FILE_CARD_MAX_H;
  // anything longer scrolls inside `.ground-card__source` (IDE-editor
  // behavior). Grow-past would bleed into the card below.
  const style: CSSProperties = { left: rect.x, top: rect.y, width: rect.w, height: rect.h };
  // Author / latency tints blend toward white (not `var(--bg)`) so cards
  // stay crisp even when a tint is active — previous 24% / 18% blends
  // against a non-white `--bg` made the whole card look faded.
  if (authorTint) {
    style.background = `color-mix(in srgb, ${authorTint} 10%, #ffffff)`;
  } else if (latencyTint) {
    style.background = `color-mix(in srgb, ${latencyTint} 8%, #ffffff)`;
  }

  return (
    <div
      className={`ground-card${isSelected ? " ground-card--selected" : ""}${isEditing ? " ground-card--editing" : ""}${isRippling ? " ground-card--rippling" : ""}${isRippleSource ? " ground-card--ripple-source" : ""}`}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`Select file ${file.name}`}
      aria-pressed={isSelected}
      // While the inline editor is open, the card IS the overlay: pointer
      // events originating inside must not leak to pixi edge-pick/hover
      // beneath. The data-canvas-opaque contract lives in use-canvas-
      // interactions.ts (shouldYieldToOverlay).
      data-canvas-opaque={isEditing ? "true" : undefined}
      onClick={() => { onSelect(file.id); }}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={onHover ? () => onHover(file.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(file.id);
        }
      }}
    >
      <div className="ground-card__header">
        <span className="ground-card__filename">
          {file.name}
          {isDirty && <span className="ground-card__dirty-dot" title="Unsaved changes" />}
        </span>
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
        {stripes.length > 0 && effectiveBlame && !isEditing && (
          <BlameGutter stripes={stripes} lineCount={effectiveBlame.lineCount} entries={effectiveBlame} />
        )}
        {loading && (
          <div className="ground-card__placeholder">Loading…</div>
        )}
        {!loading && !data?.source && (
          <div className="ground-card__placeholder">—</div>
        )}
        {!loading && data?.source && isEditing && (
          <InlineCodeEditor
            fileId={file.id}
            initialSource={data.source}
            filename={file.name}
            onExit={handleExitEdit}
          />
        )}
        {!loading && data?.source && !isEditing && (
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
    prev.effects === next.effects &&
    prev.latency === next.latency &&
    prev.showEffectBadges === next.showEffectBadges &&
    prev.showLatencyOverlay === next.showLatencyOverlay &&
    prev.authorTint === next.authorTint &&
    prev.onSelect === next.onSelect &&
    prev.onHover === next.onHover,
);
