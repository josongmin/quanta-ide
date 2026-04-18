import type { GraphHistory } from "@quanta/canvas-engine";
import { useFeature } from "../store/feature-flags-store";
import { useInteractionStore } from "../store/interaction-store";
import { mockAuthorForSnapshot } from "../lib/mock-ai-service";

// AuthorFootprintOverlay (temporal.authorFootprint)
// -----------------------------------------------------------------
// When enabled AND a live temporal snapshot is active, tint each
// file card in the scene by the dominant author who touched it in
// that snapshot. This file owns only the legend widget + the
// pure helpers used by MultiFileCanvas to compute per-file tints.
// The actual `authorTint` prop is passed into StreetCard/GroundCard
// from MultiFileCanvas, which reads `computeAuthorTints`.

// Stable author → color mapping. We hash the author name so new
// authors (from GitHistorySource) get a deterministic slot without
// shifting existing ones.
const AUTHOR_PALETTE: readonly string[] = [
  "#38bdf8", // sky
  "#f472b6", // rose
  "#34d399", // emerald
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#fb7185", // pink
  "#60a5fa", // blue
  "#2dd4bf", // teal
];

function hashStringFnv(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function authorColor(author: string): string {
  const h = hashStringFnv(author);
  return AUTHOR_PALETTE[h % AUTHOR_PALETTE.length];
}

export interface AuthorFootprintContext {
  /** file id → hex color. Empty map ⇒ feature inert / no history. */
  tintByFile: ReadonlyMap<string, string>;
  /** Authors encountered in the active snapshot (sorted, deterministic). */
  authorsInSnapshot: readonly string[];
}

/**
 * Compute a per-file tint for the active snapshot. Strategy:
 *   - Walk the current snapshot's added/removed edge ids.
 *   - Credit each file incident on those edges to the snapshot's
 *     "dominant author" (MockHistorySource cycles alice/bob/charlie/dana
 *     by snapshot index; we reproduce the mapping deterministically).
 *   - Files with no touched edges in that snapshot are left un-tinted.
 */
export function computeAuthorTints(
  history: GraphHistory | undefined,
  snapshotIndex: number,
  graphEdges: readonly { id: string; from: string; to: string }[],
): AuthorFootprintContext {
  const tintByFile = new Map<string, string>();
  const authorSet = new Set<string>();
  if (!history) return { tintByFile, authorsInSnapshot: [] };
  const snap = history.snapshots[snapshotIndex];
  if (!snap) return { tintByFile, authorsInSnapshot: [] };

  const author = mockAuthorForSnapshot(snapshotIndex);
  authorSet.add(author);
  const tint = authorColor(author);

  const edgeIds = [
    ...(snap.edgeIds ?? []),
    ...(snap.added ?? []),
    ...(snap.removed ?? []),
  ];
  const edgeMap = new Map<string, { from: string; to: string }>();
  for (const e of graphEdges) edgeMap.set(e.id, e);
  for (const id of edgeIds) {
    const edge = edgeMap.get(id);
    if (!edge) continue;
    tintByFile.set(edge.from, tint);
    tintByFile.set(edge.to, tint);
  }

  return {
    tintByFile,
    authorsInSnapshot: [...authorSet].sort(),
  };
}

/**
 * Top-right legend widget — rendered whenever the feature is enabled
 * AND temporal live mode is active. Lists the authors present at
 * the active snapshot with their color swatches.
 */
export function AuthorFootprintLegend({ history }: { history: GraphHistory | undefined }) {
  const enabled = useFeature("temporal.authorFootprint");
  const temporal = useInteractionStore(s => s.temporal);

  if (!enabled || !history) return null;
  if (temporal.mode !== "live") return null;
  const idx = temporal.snapshotIndex;
  const author = mockAuthorForSnapshot(idx);
  // Mock source cycles 4 authors — we render the full palette so
  // legend is stable even if the current snapshot only surfaces one.
  const authors = ["alice", "bob", "charlie", "dana"];

  return (
    <div style={legendStyle} role="status" aria-label="Author footprint legend">
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 4 }}>
        Authors
      </div>
      {authors.map(a => {
        const active = a === author;
        return (
          <div
            key={a}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: active ? 1 : 0.45,
              fontSize: 11,
              padding: "1px 0",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: authorColor(a),
                boxShadow: active ? "0 0 6px rgba(56,189,248,0.5)" : "none",
              }}
            />
            <span style={{ fontFamily: "JetBrains Mono, ui-monospace, monospace" }}>{a}</span>
            {active && <span style={{ marginLeft: "auto", fontSize: 9, opacity: 0.8 }}>active</span>}
          </div>
        );
      })}
    </div>
  );
}

const legendStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  background: "rgba(15, 23, 42, 0.96)",
  color: "#e2e8f0",
  borderRadius: 6,
  padding: "8px 10px",
  fontFamily: "system-ui, sans-serif",
  zIndex: 22,
  minWidth: 120,
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
};
