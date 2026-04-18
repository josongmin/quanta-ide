import { useMemo, useState } from "react";
import { FilterDslInput } from "./FilterDslInput";
import { diffSnapshots } from "@quanta/canvas-engine";
import { viewportStore, useViewportStore } from "../../store/viewport-store";
import { useSceneStore } from "../../store/scene-store";
import { useInteractionStore, interactionStore, type TemporalMode } from "../../store/interaction-store";
import {
  useRenderSettings,
  renderSettingsStore,
  type EdgeKind,
  type EdgeLayer,
  type EdgeSeverity,
} from "../../store/render-settings-store";
import { useUxSettings, uxSettingsStore } from "../../store/ux-settings-store";
import { useDebugSettings, debugSettingsStore } from "../../store/debug-settings-store";
import { stickiesStore, useStickiesStore, type Sticky } from "../../store/stickies-store";
import { buildShareUrl, decodeWorkspaceState } from "../../lib/workspace-url";
import {
  applyWorkspaceUrlState,
  captureWorkspaceUrlState,
  resetWorkspaceUrlState,
} from "../../lib/apply-workspace-url";

const EDGE_KINDS: readonly EdgeKind[] = ["import", "taint-propagation", "blast"] as const;
const EDGE_LAYERS: readonly EdgeLayer[] = ["structural", "flow", "safety", "impact"] as const;
const EDGE_SEVERITIES: readonly EdgeSeverity[] = ["low", "medium", "high", "critical"] as const;

function scenePct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

type LayerBreakdown = Record<EdgeLayer, { total: number; byKind: Record<string, number> }>;

function emptyLayerBreakdown(): LayerBreakdown {
  return {
    structural: { total: 0, byKind: {} },
    flow: { total: 0, byKind: {} },
    safety: { total: 0, byKind: {} },
    impact: { total: 0, byKind: {} },
  };
}

function countByLayer(
  edges: readonly { kind: string; layer?: EdgeLayer }[],
): LayerBreakdown {
  const out = emptyLayerBreakdown();
  for (const e of edges) {
    // Fallback: if an older edge somehow lacks layer, skip the layer bucket.
    const layer = e.layer;
    if (!layer) continue;
    const bucket = out[layer];
    bucket.total += 1;
    bucket.byKind[e.kind] = (bucket.byKind[e.kind] ?? 0) + 1;
  }
  return out;
}

function copyViewportToClipboard(): void {
  const v = viewportStore.getState().viewport;
  const txt = `x=${v.x.toFixed(1)}, y=${v.y.toFixed(1)}, scale=${(v.scale * 100).toFixed(2)}%`;
  navigator.clipboard?.writeText(txt).catch(() => {});
}

function resetViewport(): void {
  const v = viewportStore.getState().viewport;
  viewportStore.setViewport({ ...v, x: 0, y: 0, scale: 1 });
}

function centerViewport(): void {
  const v = viewportStore.getState().viewport;
  viewportStore.setViewport({ ...v, x: v.width / 2, y: v.height / 2 });
}

export function SceneSection() {
  const viewport = useViewportStore(s => s.viewport);
  const layout = useSceneStore(s => s.layout);
  const visible = useSceneStore(s => s.visibleScene);
  const clusters = useSceneStore(s => s.clusterScene);
  const superclusters = useSceneStore(s => s.superclusterScene);
  const graph = useSceneStore(s => s.graph);
  const layoutProgress = useSceneStore(s => s.layoutProgress);

  const showEdges = useRenderSettings(s => s.showEdges);
  const showGridBg = useUxSettings(s => s.showGridBg);
  const showHitLayers = useUxSettings(s => s.showHitLayers);
  const showHeatmap = useUxSettings(s => s.showHeatmap);
  const showBlameGutter = useRenderSettings(s => s.showBlameGutter);
  const edgeKinds = useRenderSettings(s => s.edgeKinds);
  const edgeLayers = useRenderSettings(s => s.edgeLayers);
  const showSccBubbles = useRenderSettings(s => s.showSccBubbles);
  const showStartHereBadges = useRenderSettings(s => s.showStartHereBadges);
  const startHereTopN = useRenderSettings(s => s.startHereTopN);
  const showClusterEdges = useRenderSettings(s => s.showClusterEdges);
  const showAgentPresence = useRenderSettings(s => s.showAgentPresence);
  const elevationMode = useRenderSettings(s => s.elevationMode);
  const showEffectBadges = useRenderSettings(s => s.showEffectBadges);
  const showLatencyOverlay = useRenderSettings(s => s.showLatencyOverlay);
  const pathQuery = useInteractionStore(s => s.pathQuery);
  const pathResult = useInteractionStore(s => s.pathResult);
  const temporal = useInteractionStore(s => s.temporal);
  const highlightArchViolations = useRenderSettings(s => s.highlightArchViolations);
  const showCrossGraphEdges = useRenderSettings(s => s.showCrossGraphEdges);
  const highlightCrossGraph = useRenderSettings(s => s.highlightCrossGraph);
  const archViolations = useSceneStore(s => s.layout?.archViolations);

  const edgeMinSeverity = useRenderSettings(s => s.edgeMinSeverity);
  const edgeWidthMul = useRenderSettings(s => s.edgeWidthMul);
  const freezeScene = useDebugSettings(s => s.freezeScene);
  const focusMode = useInteractionStore(s => s.focusMode);
  const focusHops = useInteractionStore(s => s.focusHops);
  const focusDimOpacity = useInteractionStore(s => s.focusDimOpacity);

  const tb = layout?.totalBounds;
  const clusterTotal = layout?.clusters?.length ?? 0;
  const clusterVisible = clusters?.clusters.length ?? 0;
  const superTotal = layout?.superclusters?.length ?? 0;
  const superVisible = superclusters?.superclusters.length ?? 0;

  // Edge breakdown is cheap (linear scan) but visible.edges can be 10k+ —
  // memoize so panning doesn't re-count every viewport tick. Grouped
  // primarily by EdgeLayer (structural/flow/safety/impact); each layer
  // keeps its kind-level totals for the indented sub-rows.
  const layerBreakdown = useMemo(
    () => countByLayer(visible?.edges ?? []),
    [visible?.edges],
  );
  const totalLayerBreakdown = useMemo(
    () => countByLayer(graph?.fileEdges ?? []),
    [graph?.fileEdges],
  );

  return (
    <>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">scale</span>
        <span className="ws-debug__v">{(viewport.scale * 100).toFixed(2)}%</span>

        <span className="ws-debug__k">viewport</span>
        <span className="ws-debug__v">
          {Math.round(viewport.x)}, {Math.round(viewport.y)} · {viewport.width}×{viewport.height}
        </span>

        <span className="ws-debug__k">layout</span>
        <span className="ws-debug__v">
          {tb ? `${Math.round(tb.w).toLocaleString()}×${Math.round(tb.h).toLocaleString()}` : "—"}
        </span>

        <span className="ws-debug__k">worker-rtt</span>
        <span className="ws-debug__v">
          {layoutProgress.lastUpdateMs > 0
            ? `${Math.round(layoutProgress.lastUpdateMs)}ms`
            : "—"}
        </span>

        <span className="ws-debug__k">files</span>
        <span className="ws-debug__v">
          {visible ? `${visible.files.length.toLocaleString()} / ${graph?.files.length.toLocaleString() ?? 0}` : "—"}
          {visible && graph && ` (${scenePct(visible.files.length, graph.files.length)}%)`}
        </span>

        <span className="ws-debug__k">edges</span>
        <span className="ws-debug__v">
          {visible ? `${visible.edges.length.toLocaleString()} / ${graph?.fileEdges.length.toLocaleString() ?? 0}` : "—"}
        </span>

        {EDGE_LAYERS.map(layer => (
          <EdgeLayerRow
            key={layer}
            layer={layer}
            visible={layerBreakdown[layer].total}
            total={totalLayerBreakdown[layer].total}
            visibleByKind={layerBreakdown[layer].byKind}
            totalByKind={totalLayerBreakdown[layer].byKind}
          />
        ))}

        <span className="ws-debug__k">clusters</span>
        <span className="ws-debug__v">
          {clusterTotal > 0 ? `${clusterVisible} / ${clusterTotal}` : "—"}
        </span>

        <span className="ws-debug__k">superclusters</span>
        <span className="ws-debug__v">
          {superTotal > 0 ? `${superVisible} / ${superTotal}` : "—"}
        </span>

        <span className="ws-debug__k">scene</span>
        <span className="ws-debug__v">
          {superclusters ? "supercluster" : clusters ? "cluster" : visible ? "file" : "—"}
        </span>
      </div>

      <div className="ws-debug__divider">layers</div>
      <div className="ws-debug__lod" style={{ gap: 2 }}>
        {EDGE_LAYERS.map(layer => (
          <button
            key={layer}
            type="button"
            className={`ws-debug__chip${edgeLayers[layer] ? " is-on" : ""}`}
            onClick={() => renderSettingsStore.setEdgeLayer(layer, !edgeLayers[layer])}
            title={layer}
          >
            {layer}
          </button>
        ))}
      </div>
      <div className="ws-debug__row" style={{ alignItems: "center" }}>
        <span style={{ flex: "0 0 82px", opacity: 0.75 }}>min severity</span>
        <div className="ws-debug__lod" style={{ gap: 2, flex: 1 }}>
          {EDGE_SEVERITIES.map(sev => (
            <button
              key={sev}
              type="button"
              className={`ws-debug__chip${edgeMinSeverity === sev ? " is-on" : ""}`}
              onClick={() => renderSettingsStore.setEdgeMinSeverity(sev)}
              title={`min severity: ${sev}`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      <div className="ws-debug__divider">render toggles</div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showEdges}
          onChange={e => renderSettingsStore.setShowEdges(e.target.checked)}
        />
        <span>edges (all)</span>
      </label>
      <div className="ws-debug__lod" style={{ gap: 2, marginLeft: 20 }}>
        {EDGE_KINDS.map(k => (
          <button
            key={k}
            type="button"
            className={`ws-debug__chip${edgeKinds[k] ? " is-on" : ""}`}
            onClick={() => renderSettingsStore.setEdgeKind(k, !edgeKinds[k])}
            title={k}
            disabled={!showEdges}
          >
            {k === "taint-propagation" ? "taint" : k.slice(0, 3)}
          </button>
        ))}
      </div>

      <div className="ws-debug__row" style={{ alignItems: "center" }}>
        <span style={{ flex: "0 0 82px", opacity: 0.75 }}>edge width</span>
        <input
          type="range"
          min={0.25}
          max={3}
          step={0.05}
          value={edgeWidthMul}
          onChange={e => renderSettingsStore.setEdgeWidthMul(parseFloat(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ flex: "0 0 42px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {edgeWidthMul.toFixed(2)}×
        </span>
      </div>

      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showGridBg}
          onChange={e => uxSettingsStore.setShowGridBg(e.target.checked)}
        />
        <span>grid bg</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showHitLayers}
          onChange={e => uxSettingsStore.setShowHitLayers(e.target.checked)}
        />
        <span>hit layers</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={freezeScene}
          onChange={e => debugSettingsStore.setFreezeScene(e.target.checked)}
        />
        <span>freeze scene</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showHeatmap}
          onChange={e => uxSettingsStore.setShowHeatmap(e.target.checked)}
        />
        <span>minimap heatmap</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={elevationMode}
          onChange={e => renderSettingsStore.setElevationMode(e.target.checked)}
        />
        <span>elevation mode (3D)</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showBlameGutter}
          onChange={e => renderSettingsStore.setShowBlameGutter(e.target.checked)}
        />
        <span>blame gutter (ground)</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showEffectBadges}
          onChange={e => renderSettingsStore.setShowEffectBadges(e.target.checked)}
        />
        <span>effect badges (chips)</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showLatencyOverlay}
          onChange={e => renderSettingsStore.setShowLatencyOverlay(e.target.checked)}
        />
        <span>cost overlay (p95 tint)</span>
      </label>

      <div className="ws-debug__divider">overlays</div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showSccBubbles}
          onChange={e => renderSettingsStore.setShowSccBubbles(e.target.checked)}
        />
        <span>cycle bubbles (SCC)</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showStartHereBadges}
          onChange={e => renderSettingsStore.setShowStartHereBadges(e.target.checked)}
        />
        <span>start-here badges</span>
      </label>
      <div className="ws-debug__lod" style={{ gap: 2, marginLeft: 20 }}>
        {([3, 5, 10] as const).map(n => (
          <button
            key={n}
            type="button"
            className={`ws-debug__chip${startHereTopN === n ? " is-on" : ""}`}
            onClick={() => renderSettingsStore.setStartHereTopN(n)}
            disabled={!showStartHereBadges}
            title={`top-${n}`}
          >
            top-{n}
          </button>
        ))}
      </div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showClusterEdges}
          onChange={e => renderSettingsStore.setShowClusterEdges(e.target.checked)}
        />
        <span>cluster super-edges</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showAgentPresence}
          onChange={e => renderSettingsStore.setShowAgentPresence(e.target.checked)}
        />
        <span>agent presence rings</span>
      </label>

      <div className="ws-debug__divider">focus</div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={focusMode === "on"}
          onChange={e => interactionStore.setFocusMode(e.target.checked ? "on" : "off")}
        />
        <span>focus mode</span>
      </label>
      <div className="ws-debug__lod" style={{ gap: 2, marginLeft: 20 }}>
        {([1, 2] as const).map(h => (
          <button
            key={h}
            type="button"
            className={`ws-debug__chip${focusHops === h ? " is-on" : ""}`}
            onClick={() => interactionStore.setFocusHops(h)}
            disabled={focusMode !== "on"}
            title={`${h}-hop`}
          >
            {h}-hop
          </button>
        ))}
      </div>
      <div className="ws-debug__row" style={{ alignItems: "center" }}>
        <span style={{ flex: "0 0 82px", opacity: 0.75 }}>dim opacity</span>
        <input
          type="range"
          min={0}
          max={0.5}
          step={0.01}
          value={focusDimOpacity}
          onChange={e => interactionStore.setFocusDimOpacity(parseFloat(e.target.value))}
          disabled={focusMode !== "on"}
          style={{ flex: 1 }}
        />
        <span style={{ flex: "0 0 42px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {focusDimOpacity.toFixed(2)}
        </span>
      </div>

      <div className="ws-debug__divider">filter DSL</div>
      <FilterDslInput />

      <div className="ws-debug__divider">
        arch violations
        {archViolations && archViolations.edgeIds.length > 0 && (
          <span style={{ color: "#f87171" }}> · {archViolations.edgeIds.length}</span>
        )}
      </div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={highlightArchViolations}
          onChange={e => renderSettingsStore.setHighlightArchViolations(e.target.checked)}
        />
        <span>highlight violating edges</span>
      </label>
      {archViolations && Object.keys(archViolations.byPair).length > 0 && (
        <div className="ws-debug__grid">
          {Object.entries(archViolations.byPair).map(([pair, n]) => (
            <>
              <span key={`k-${pair}`} className="ws-debug__k" style={{ paddingLeft: 8, opacity: 0.75 }}>
                · {pair}
              </span>
              <span key={`v-${pair}`} className="ws-debug__v" style={{ color: "#f87171" }}>
                {n}
              </span>
            </>
          ))}
        </div>
      )}

      <div className="ws-debug__divider">cross-graph edges</div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showCrossGraphEdges}
          onChange={e => renderSettingsStore.setShowCrossGraphEdges(e.target.checked)}
        />
        <span>show cross-graph edges</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={highlightCrossGraph}
          onChange={e => renderSettingsStore.setHighlightCrossGraph(e.target.checked)}
        />
        <span>highlight cross-graph (gold overlay)</span>
      </label>

      <div className="ws-debug__divider">
        path query {pathQuery && <span style={{ color: "#7dd3fc" }}>· active</span>}
      </div>
      {pathQuery ? (
        <>
          <div className="ws-debug__grid">
            <span className="ws-debug__k">src</span>
            <span className="ws-debug__v" title={pathQuery.sourceFileId}>
              {basename(pathQuery.sourceFileId)}
            </span>
            <span className="ws-debug__k">→ dst</span>
            <span className="ws-debug__v" title={pathQuery.targetFileId}>
              {basename(pathQuery.targetFileId)}
            </span>
            <span className="ws-debug__k">mode</span>
            <span className="ws-debug__v">{pathQuery.mode}</span>
            <span className="ws-debug__k">paths</span>
            <span className="ws-debug__v">
              {pathResult ? pathResult.paths.length : 0}
              {pathResult?.truncated && (
                <span style={{ color: "#f87171", marginLeft: 4 }}>· truncated</span>
              )}
            </span>
            {pathResult && pathResult.paths.length > 0 && (
              <>
                <span className="ws-debug__k">hops</span>
                <span className="ws-debug__v">
                  {Math.min(...pathResult.paths.map(p => p.cost))}
                  {pathResult.paths.length > 1 && `..${Math.max(...pathResult.paths.map(p => p.cost))}`}
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            className="ws-debug__chip"
            style={{ marginTop: 4, width: "100%" }}
            onClick={() => interactionStore.clearPathQuery()}
          >
            clear
          </button>
        </>
      ) : (
        <div className="ws-debug__hint">
          shift+click second file after selecting one to query a shortest path.
        </div>
      )}

      <TemporalSection temporal={temporal} history={graph?.history} />

      <StickiesSection />

      <div className="ws-debug__divider">viewport</div>
      <div className="ws-debug__lod" style={{ gap: 2 }}>
        <button type="button" className="ws-debug__chip" onClick={resetViewport} title="x=0,y=0,scale=1">
          reset
        </button>
        <button type="button" className="ws-debug__chip" onClick={centerViewport} title="center pan">
          center
        </button>
        <button type="button" className="ws-debug__chip" onClick={copyViewportToClipboard} title="copy x,y,scale">
          copy
        </button>
      </div>

      <ShareSection />
    </>
  );
}

function ShareSection() {
  const autoSyncUrl = useUxSettings(s => s.autoSyncUrl);
  const [toast, setToast] = useState<string | null>(null);

  const flashToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1500);
  };

  const copyShareLink = async () => {
    const state = captureWorkspaceUrlState();
    const base =
      typeof window !== "undefined"
        ? window.location.origin + window.location.pathname
        : "";
    const url = buildShareUrl(base, state);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        flashToast("copied!");
      } else {
        window.prompt("copy share link", url);
        flashToast("copy manually");
      }
    } catch {
      window.prompt("copy share link", url);
      flashToast("copy manually");
    }
  };

  const importFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        flashToast("clipboard unavailable");
        return;
      }
      const raw = await navigator.clipboard.readText();
      const trimmed = raw.trim();
      let encoded = trimmed;
      const match = trimmed.match(/[?&]ws=([^&\s#]+)/);
      if (match) encoded = match[1] ?? "";
      const state = decodeWorkspaceState(encoded);
      if (!state) {
        flashToast("invalid link");
        return;
      }
      applyWorkspaceUrlState(state);
      flashToast("applied!");
    } catch {
      flashToast("clipboard error");
    }
  };

  const resetAll = () => {
    resetWorkspaceUrlState();
    flashToast("reset");
  };

  return (
    <>
      <div className="ws-debug__divider">
        share {toast && <span style={{ color: "#7dd3fc" }}>· {toast}</span>}
      </div>
      <div className="ws-debug__lod" style={{ gap: 2 }}>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={copyShareLink}
          title="encode state + write to clipboard"
        >
          copy share link
        </button>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={importFromClipboard}
          title="read clipboard + apply"
        >
          import
        </button>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={resetAll}
          title="reset to defaults"
        >
          reset
        </button>
      </div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={autoSyncUrl}
          onChange={e => uxSettingsStore.setAutoSyncUrl(e.target.checked)}
        />
        <span>auto-sync URL</span>
      </label>
    </>
  );
}

const TEMPORAL_MODES: readonly TemporalMode[] = ["off", "live", "diff"] as const;

function TemporalSection({
  temporal,
  history,
}: {
  temporal: ReturnType<typeof interactionStore.getState>["temporal"];
  history: import("@quanta/canvas-engine").GraphHistory | undefined;
}) {
  // Memo the diff count so scrubbing only pays for the walk when the range
  // actually changes. Cheap (O(|edges|)) but not free at 10k+ edges.
  const diffCount = useMemo(() => {
    if (temporal.mode !== "diff" || !history) return null;
    const d = diffSnapshots(history, temporal.diffFrom, temporal.diffTo);
    return { added: d.added.size, removed: d.removed.size };
  }, [temporal.mode, temporal.diffFrom, temporal.diffTo, history]);

  const snaps = history?.snapshots ?? [];
  const count = snaps.length;

  return (
    <>
      <div className="ws-debug__divider">temporal</div>
      {count < 2 ? (
        <div className="ws-debug__hint">no history attached to this graph.</div>
      ) : (
        <>
          <div className="ws-debug__lod" style={{ gap: 2 }}>
            {TEMPORAL_MODES.map(m => (
              <button
                key={m}
                type="button"
                className={`ws-debug__chip${temporal.mode === m ? " is-on" : ""}`}
                onClick={() => interactionStore.setTemporalMode(m)}
                title={`temporal: ${m}`}
              >
                {m}
              </button>
            ))}
          </div>

          {temporal.mode === "live" && (
            <>
              <div className="ws-debug__row" style={{ alignItems: "center" }}>
                <span style={{ flex: "0 0 82px", opacity: 0.75 }}>
                  {snaps[temporal.snapshotIndex]?.label ?? `#${temporal.snapshotIndex}`}
                </span>
                <input
                  type="range"
                  min={0}
                  max={count - 1}
                  step={1}
                  value={temporal.snapshotIndex}
                  onChange={e => interactionStore.setSnapshotIndex(parseInt(e.target.value, 10))}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className={`ws-debug__chip${temporal.playing ? " is-on" : ""}`}
                  onClick={() => interactionStore.setTemporalPlaying(!temporal.playing)}
                  style={{ flex: "0 0 42px" }}
                  title={temporal.playing ? "pause" : "play"}
                >
                  {temporal.playing ? "pause" : "play"}
                </button>
              </div>
              <div className="ws-debug__lod" style={{ gap: 2 }}>
                {snaps.map((s, i) => (
                  <button
                    key={s.label + i}
                    type="button"
                    className={`ws-debug__chip${temporal.snapshotIndex === i ? " is-on" : ""}`}
                    onClick={() => interactionStore.setSnapshotIndex(i)}
                    title={new Date(s.timestamp).toISOString().slice(0, 10)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {temporal.mode === "diff" && (
            <>
              <div className="ws-debug__row" style={{ alignItems: "center" }}>
                <span style={{ flex: "0 0 82px", opacity: 0.75 }}>from (A)</span>
                <div className="ws-debug__lod" style={{ gap: 2, flex: 1 }}>
                  {snaps.map((s, i) => (
                    <button
                      key={`from-${s.label}-${i}`}
                      type="button"
                      className={`ws-debug__chip${temporal.diffFrom === i ? " is-on" : ""}`}
                      onClick={() => interactionStore.setDiffRange(i, temporal.diffTo)}
                      title={`from: ${s.label}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ws-debug__row" style={{ alignItems: "center" }}>
                <span style={{ flex: "0 0 82px", opacity: 0.75 }}>to (B)</span>
                <div className="ws-debug__lod" style={{ gap: 2, flex: 1 }}>
                  {snaps.map((s, i) => (
                    <button
                      key={`to-${s.label}-${i}`}
                      type="button"
                      className={`ws-debug__chip${temporal.diffTo === i ? " is-on" : ""}`}
                      onClick={() => interactionStore.setDiffRange(temporal.diffFrom, i)}
                      title={`to: ${s.label}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {diffCount && (
                <div className="ws-debug__grid">
                  <span className="ws-debug__k">summary</span>
                  <span className="ws-debug__v">
                    <span style={{ color: "#22c55e" }}>+{diffCount.added}</span>
                    {" / "}
                    <span style={{ color: "#ef4444" }}>-{diffCount.removed}</span>
                  </span>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

function EdgeLayerRow({
  layer,
  visible,
  total,
  visibleByKind,
  totalByKind,
}: {
  layer: EdgeLayer;
  visible: number;
  total: number;
  visibleByKind: Record<string, number>;
  totalByKind: Record<string, number>;
}) {
  // Show the per-layer total prominently; indent the kinds that actually
  // exist under this layer so the HUD stays scannable instead of dumping
  // 15+ zero rows for unseen kinds.
  const kinds = Object.keys({ ...visibleByKind, ...totalByKind }).sort();
  return (
    <>
      <span className="ws-debug__k" style={{ paddingLeft: 8, opacity: 0.9 }}>· {layer}</span>
      <span className="ws-debug__v">
        {visible.toLocaleString()} / {total.toLocaleString()}
      </span>
      {kinds.map(kind => {
        const v = visibleByKind[kind] ?? 0;
        const t = totalByKind[kind] ?? 0;
        if (v === 0 && t === 0) return null;
        const label = kind === "taint-propagation" ? "taint" : kind;
        return (
          <FragmentRow
            key={`${layer}:${kind}`}
            k={label}
            v={`${v.toLocaleString()} / ${t.toLocaleString()}`}
          />
        );
      })}
    </>
  );
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span className="ws-debug__k" style={{ paddingLeft: 20, opacity: 0.6 }}>· {k}</span>
      <span className="ws-debug__v" style={{ opacity: 0.75 }}>{v}</span>
    </>
  );
}

function panToWorld(x: number, y: number, w: number, h: number) {
  const vp = viewportStore.getState().viewport;
  if (vp.width <= 0 || vp.height <= 0 || vp.scale <= 0) return;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const nx = vp.width / 2 - cx * vp.scale;
  const ny = vp.height / 2 - cy * vp.scale;
  viewportStore.setViewport({ ...vp, x: nx, y: ny });
}

function previewText(s: Sticky): string {
  const t = s.text.trim();
  if (t.length === 0) return "(empty)";
  return t.length > 48 ? t.slice(0, 45) + "…" : t;
}

function StickiesSection() {
  const stickies = useStickiesStore(s => s.stickies);
  const showStickies = useUxSettings(s => s.showStickies);

  const recent = useMemo(() => {
    const arr = [...stickies].sort((a, b) => b.updatedAt - a.updatedAt);
    return arr.slice(0, 6);
  }, [stickies]);

  const resolvedCount = useMemo(
    () => stickies.filter(s => s.resolved).length,
    [stickies],
  );

  return (
    <>
      <div className="ws-debug__divider">
        stickies ({stickies.length})
        {resolvedCount > 0 && (
          <span style={{ color: "#22c55e" }}> · {resolvedCount} done</span>
        )}
      </div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showStickies}
          onChange={e => uxSettingsStore.setShowStickies(e.target.checked)}
        />
        <span>show stickies</span>
      </label>
      {recent.length === 0 ? (
        <div className="ws-debug__hint">shift+dblclick empty canvas to drop a sticky.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
          {recent.map(s => (
            <div
              key={s.id}
              className={`ws-debug__sticky-row${s.resolved ? " ws-debug__sticky-row--resolved" : ""}`}
              onClick={() => panToWorld(s.x, s.y, s.width, s.height)}
              title={s.text || "(empty)"}
            >
              <span className={`ws-debug__sticky-dot ws-debug__sticky-dot--${s.color}`} />
              <span className="ws-debug__sticky-text">{previewText(s)}</span>
              <input
                type="checkbox"
                className="ws-debug__sticky-check"
                checked={s.resolved ?? false}
                onClick={e => e.stopPropagation()}
                onChange={() => stickiesStore.toggleResolved(s.id)}
                title="mark done"
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
