import { useEffect, useMemo, useState } from "react";
import { FilterDslInput } from "./FilterDslInput";
import { NlFilterInput } from "./NlFilterInput";
import { AiAssistSection } from "./AiAssistSection";
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
import { featureFlagsStore, useFeature } from "../../store/feature-flags-store";
import { usePagesStore } from "../../store/pages-store";
import {
  useBookmarksStore,
  bookmarksForPage,
} from "../../store/bookmarks-store";
import { storyboardStore } from "../../store/storyboard-store";
import { captureCurrentBookmark } from "../BookmarksDrawer";
import { useImagesStore, imagesStore, IMAGE_MAX_COUNT } from "../../store/images-store";
import { useTicketLinksStore, ticketLinksStore } from "../../store/ticket-links-store";
import { listMockTickets, type TicketSource, type TicketState } from "../../lib/mock-tickets";
import { listMockPrs, buildPrsByFile } from "../../lib/mock-prs";
import { listMockSlackThreads, resolveSlackRelatedFileId } from "../../lib/mock-slack";
import { SlackEmbed } from "../SlackEmbed";
import { CommentsSection } from "./CommentsSection";
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
        <span className="ws-debug__k">스케일</span>
        <span className="ws-debug__v">{(viewport.scale * 100).toFixed(2)}%</span>

        <span className="ws-debug__k">뷰포트</span>
        <span className="ws-debug__v">
          {Math.round(viewport.x)}, {Math.round(viewport.y)} · {viewport.width}×{viewport.height}
        </span>

        <span className="ws-debug__k">레이아웃</span>
        <span className="ws-debug__v">
          {tb ? `${Math.round(tb.w).toLocaleString()}×${Math.round(tb.h).toLocaleString()}` : "—"}
        </span>

        <span className="ws-debug__k">워커 RTT</span>
        <span className="ws-debug__v">
          {layoutProgress.lastUpdateMs > 0
            ? `${Math.round(layoutProgress.lastUpdateMs)}ms`
            : "—"}
        </span>

        <span className="ws-debug__k">파일</span>
        <span className="ws-debug__v">
          {visible ? `${visible.files.length.toLocaleString()} / ${graph?.files.length.toLocaleString() ?? 0}` : "—"}
          {visible && graph && ` (${scenePct(visible.files.length, graph.files.length)}%)`}
        </span>

        <span className="ws-debug__k">엣지</span>
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

        <span className="ws-debug__k">클러스터</span>
        <span className="ws-debug__v">
          {clusterTotal > 0 ? `${clusterVisible} / ${clusterTotal}` : "—"}
        </span>

        <span className="ws-debug__k">슈퍼클러스터</span>
        <span className="ws-debug__v">
          {superTotal > 0 ? `${superVisible} / ${superTotal}` : "—"}
        </span>

        <span className="ws-debug__k">씬 종류</span>
        <span className="ws-debug__v">
          {superclusters ? "슈퍼클러스터" : clusters ? "클러스터" : visible ? "파일" : "—"}
        </span>
      </div>

      <div className="ws-debug__divider">레이어</div>
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
        <span style={{ flex: "0 0 82px", opacity: 0.75 }}>최소 심각도</span>
        <div className="ws-debug__lod" style={{ gap: 2, flex: 1 }}>
          {EDGE_SEVERITIES.map(sev => (
            <button
              key={sev}
              type="button"
              className={`ws-debug__chip${edgeMinSeverity === sev ? " is-on" : ""}`}
              onClick={() => renderSettingsStore.setEdgeMinSeverity(sev)}
              title={`최소 심각도: ${sev}`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      <div className="ws-debug__divider">렌더링 토글</div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showEdges}
          onChange={e => renderSettingsStore.setShowEdges(e.target.checked)}
        />
        <span>엣지 (전체)</span>
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
        <span style={{ flex: "0 0 82px", opacity: 0.75 }}>엣지 두께</span>
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
        <span>그리드 배경</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showHitLayers}
          onChange={e => uxSettingsStore.setShowHitLayers(e.target.checked)}
        />
        <span>히트 레이어</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={freezeScene}
          onChange={e => debugSettingsStore.setFreezeScene(e.target.checked)}
        />
        <span>씬 고정</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showHeatmap}
          onChange={e => uxSettingsStore.setShowHeatmap(e.target.checked)}
        />
        <span>미니맵 히트맵</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={elevationMode}
          onChange={e => renderSettingsStore.setElevationMode(e.target.checked)}
        />
        <span>고도 모드 (3D)</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showBlameGutter}
          onChange={e => renderSettingsStore.setShowBlameGutter(e.target.checked)}
        />
        <span>블레임 거터 (그라운드)</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showEffectBadges}
          onChange={e => renderSettingsStore.setShowEffectBadges(e.target.checked)}
        />
        <span>이펙트 배지 (칩)</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showLatencyOverlay}
          onChange={e => renderSettingsStore.setShowLatencyOverlay(e.target.checked)}
        />
        <span>비용 오버레이 (p95 틴트)</span>
      </label>

      <div className="ws-debug__divider">오버레이</div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showSccBubbles}
          onChange={e => renderSettingsStore.setShowSccBubbles(e.target.checked)}
        />
        <span>사이클 버블 (SCC)</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showStartHereBadges}
          onChange={e => renderSettingsStore.setShowStartHereBadges(e.target.checked)}
        />
        <span>시작점 배지</span>
      </label>
      <div className="ws-debug__lod" style={{ gap: 2, marginLeft: 20 }}>
        {([3, 5, 10] as const).map(n => (
          <button
            key={n}
            type="button"
            className={`ws-debug__chip${startHereTopN === n ? " is-on" : ""}`}
            onClick={() => renderSettingsStore.setStartHereTopN(n)}
            disabled={!showStartHereBadges}
            title={`상위 ${n}`}
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
        <span>클러스터 슈퍼 엣지</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showAgentPresence}
          onChange={e => renderSettingsStore.setShowAgentPresence(e.target.checked)}
        />
        <span>에이전트 프레즌스 링</span>
      </label>

      <div className="ws-debug__divider">포커스</div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={focusMode === "on"}
          onChange={e => interactionStore.setFocusMode(e.target.checked ? "on" : "off")}
        />
        <span>포커스 모드</span>
      </label>
      <div className="ws-debug__lod" style={{ gap: 2, marginLeft: 20 }}>
        {([1, 2] as const).map(h => (
          <button
            key={h}
            type="button"
            className={`ws-debug__chip${focusHops === h ? " is-on" : ""}`}
            onClick={() => interactionStore.setFocusHops(h)}
            disabled={focusMode !== "on"}
            title={`${h}-홉`}
          >
            {h}-hop
          </button>
        ))}
      </div>
      <div className="ws-debug__row" style={{ alignItems: "center" }}>
        <span style={{ flex: "0 0 82px", opacity: 0.75 }}>흐림 투명도</span>
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

      <FilterSection graph={graph} edgeLayers={edgeLayers} />


      <div className="ws-debug__divider">
        아키텍처 위반
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
        <span>위반 엣지 강조</span>
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

      <div className="ws-debug__divider">크로스 그래프 엣지</div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showCrossGraphEdges}
          onChange={e => renderSettingsStore.setShowCrossGraphEdges(e.target.checked)}
        />
        <span>크로스 그래프 엣지 표시</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={highlightCrossGraph}
          onChange={e => renderSettingsStore.setHighlightCrossGraph(e.target.checked)}
        />
        <span>크로스 그래프 강조 (골드 오버레이)</span>
      </label>

      <div className="ws-debug__divider">
        경로 질의 {pathQuery && <span style={{ color: "#7dd3fc" }}>· 활성</span>}
      </div>
      {pathQuery ? (
        <>
          <div className="ws-debug__grid">
            <span className="ws-debug__k">출발</span>
            <span className="ws-debug__v" title={pathQuery.sourceFileId}>
              {basename(pathQuery.sourceFileId)}
            </span>
            <span className="ws-debug__k">→ 도착</span>
            <span className="ws-debug__v" title={pathQuery.targetFileId}>
              {basename(pathQuery.targetFileId)}
            </span>
            <span className="ws-debug__k">모드</span>
            <span className="ws-debug__v">{pathQuery.mode}</span>
            <span className="ws-debug__k">경로 수</span>
            <span className="ws-debug__v">
              {pathResult ? pathResult.paths.length : 0}
              {pathResult?.truncated && (
                <span style={{ color: "#f87171", marginLeft: 4 }}>· 잘림</span>
              )}
            </span>
            {pathResult && pathResult.paths.length > 0 && (
              <>
                <span className="ws-debug__k">홉</span>
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
            비우기
          </button>
        </>
      ) : (
        <div className="ws-debug__hint">
          파일 하나 선택 후 두 번째 파일을 Shift+클릭하면 최단 경로를 질의합니다.
        </div>
      )}

      <TemporalSection temporal={temporal} history={graph?.history} />

      <DevModeSection />

      <StickiesSection />

      <AiAssistSection />

      <CommentsSection />

      <NavigationSection />

      <EmbedsSection />

      <div className="ws-debug__divider">뷰포트</div>
      <div className="ws-debug__lod" style={{ gap: 2 }}>
        <button type="button" className="ws-debug__chip" onClick={resetViewport} title="x=0, y=0, 스케일=1">
          초기화
        </button>
        <button type="button" className="ws-debug__chip" onClick={centerViewport} title="팬 중앙 정렬">
          중앙
        </button>
        <button type="button" className="ws-debug__chip" onClick={copyViewportToClipboard} title="x, y, 스케일 복사">
          복사
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
        flashToast("복사됨!");
      } else {
        window.prompt("공유 링크 복사", url);
        flashToast("직접 복사");
      }
    } catch {
      window.prompt("공유 링크 복사", url);
      flashToast("직접 복사");
    }
  };

  const importFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        flashToast("클립보드 사용 불가");
        return;
      }
      const raw = await navigator.clipboard.readText();
      const trimmed = raw.trim();
      let encoded = trimmed;
      const match = trimmed.match(/[?&]ws=([^&\s#]+)/);
      if (match) encoded = match[1] ?? "";
      const state = decodeWorkspaceState(encoded);
      if (!state) {
        flashToast("잘못된 링크");
        return;
      }
      applyWorkspaceUrlState(state);
      flashToast("적용됨!");
    } catch {
      flashToast("클립보드 오류");
    }
  };

  const resetAll = () => {
    resetWorkspaceUrlState();
    flashToast("초기화됨");
  };

  return (
    <>
      <div className="ws-debug__divider">
        공유 {toast && <span style={{ color: "#7dd3fc" }}>· {toast}</span>}
      </div>
      <div className="ws-debug__lod" style={{ gap: 2 }}>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={copyShareLink}
          title="상태 인코딩 후 클립보드에 복사"
        >
          공유 링크 복사
        </button>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={importFromClipboard}
          title="클립보드 읽어 적용"
        >
          가져오기
        </button>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={resetAll}
          title="기본값으로 초기화"
        >
          초기화
        </button>
      </div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={autoSyncUrl}
          onChange={e => uxSettingsStore.setAutoSyncUrl(e.target.checked)}
        />
        <span>URL 자동 동기화</span>
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
      <div className="ws-debug__divider">시간축</div>
      {count < 2 ? (
        <div className="ws-debug__hint">이 그래프에 연결된 히스토리가 없습니다.</div>
      ) : (
        <>
          <div className="ws-debug__lod" style={{ gap: 2 }}>
            {TEMPORAL_MODES.map(m => (
              <button
                key={m}
                type="button"
                className={`ws-debug__chip${temporal.mode === m ? " is-on" : ""}`}
                onClick={() => interactionStore.setTemporalMode(m)}
                title={`시간축 모드: ${m}`}
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
                  title={temporal.playing ? "일시정지" : "재생"}
                >
                  {temporal.playing ? "정지" : "재생"}
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
                <span style={{ flex: "0 0 82px", opacity: 0.75 }}>시작 (A)</span>
                <div className="ws-debug__lod" style={{ gap: 2, flex: 1 }}>
                  {snaps.map((s, i) => (
                    <button
                      key={`from-${s.label}-${i}`}
                      type="button"
                      className={`ws-debug__chip${temporal.diffFrom === i ? " is-on" : ""}`}
                      onClick={() => interactionStore.setDiffRange(i, temporal.diffTo)}
                      title={`시작: ${s.label}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ws-debug__row" style={{ alignItems: "center" }}>
                <span style={{ flex: "0 0 82px", opacity: 0.75 }}>끝 (B)</span>
                <div className="ws-debug__lod" style={{ gap: 2, flex: 1 }}>
                  {snaps.map((s, i) => (
                    <button
                      key={`to-${s.label}-${i}`}
                      type="button"
                      className={`ws-debug__chip${temporal.diffTo === i ? " is-on" : ""}`}
                      onClick={() => interactionStore.setDiffRange(temporal.diffFrom, i)}
                      title={`끝: ${s.label}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {diffCount && (
                <div className="ws-debug__grid">
                  <span className="ws-debug__k">요약</span>
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

// Filter input — toggles between the raw DSL and the natural-language
// entry when the ai.naturalLanguageFilter feature is on. Cmd+/ flips
// between modes; default is DSL to match the existing muscle memory.
function FilterSection({
  graph,
  edgeLayers,
}: {
  graph: import("@quanta/canvas-engine").WorkspaceGraph | null;
  edgeLayers: Record<EdgeLayer, boolean>;
}) {
  const nlOn = useFeature("ai.naturalLanguageFilter");
  const [mode, setMode] = useState<"dsl" | "nl">("dsl");

  // Cmd+/ global shortcut — flip mode when the user is somewhere inside
  // the HUD. Bound at the section level so it doesn't fight the existing
  // canvas shortcuts outside of the HUD surface.
  useEffect(() => {
    if (!nlOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key !== "/") return;
      e.preventDefault();
      setMode(m => (m === "dsl" ? "nl" : "dsl"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nlOn]);

  const enabledLayers = useMemo(
    () => (Object.entries(edgeLayers) as [EdgeLayer, boolean][])
      .filter(([, v]) => v)
      .map(([k]) => k),
    [edgeLayers],
  );
  const edgeKinds = useMemo(() => {
    const set = new Set<string>();
    for (const e of graph?.fileEdges ?? []) set.add(e.kind);
    return [...set];
  }, [graph]);
  const fileIds = useMemo(() => {
    return (graph?.files ?? []).map(f => f.id);
  }, [graph]);

  return (
    <>
      <div className="ws-debug__divider" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span>{mode === "dsl" ? "필터 DSL" : "필터 — AI"}</span>
        {nlOn && (
          <div className="ws-debug__lod" style={{ gap: 2, marginLeft: "auto" }}>
            <button
              type="button"
              className={`ws-debug__chip${mode === "dsl" ? " is-on" : ""}`}
              onClick={() => setMode("dsl")}
              title="DSL 모드"
            >
              dsl
            </button>
            <button
              type="button"
              className={`ws-debug__chip${mode === "nl" ? " is-on" : ""}`}
              onClick={() => setMode("nl")}
              title="자연어 (⌘/)"
            >
              nl
            </button>
          </div>
        )}
      </div>
      {mode === "dsl" || !nlOn ? (
        <FilterDslInput />
      ) : (
        <NlFilterInput
          edgeKinds={edgeKinds}
          edgeLayers={enabledLayers}
          fileIds={fileIds}
          onSwitchToDsl={() => setMode("dsl")}
        />
      )}
    </>
  );
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
  if (t.length === 0) return "(비어 있음)";
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
        스티커 ({stickies.length})
        {resolvedCount > 0 && (
          <span style={{ color: "#22c55e" }}> · {resolvedCount} 완료</span>
        )}
      </div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showStickies}
          onChange={e => uxSettingsStore.setShowStickies(e.target.checked)}
        />
        <span>스티커 표시</span>
      </label>
      {recent.length === 0 ? (
        <div className="ws-debug__hint">빈 캔버스에 Shift+더블클릭하여 스티커를 남기세요.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
          {recent.map(s => (
            <div
              key={s.id}
              className={`ws-debug__sticky-row${s.resolved ? " ws-debug__sticky-row--resolved" : ""}`}
              onClick={() => panToWorld(s.x, s.y, s.width, s.height)}
              title={s.text || "(비어 있음)"}
            >
              <span className={`ws-debug__sticky-dot ws-debug__sticky-dot--${s.color}`} />
              <span className="ws-debug__sticky-text">{previewText(s)}</span>
              <input
                type="checkbox"
                className="ws-debug__sticky-check"
                checked={s.resolved ?? false}
                onClick={e => e.stopPropagation()}
                onChange={() => stickiesStore.toggleResolved(s.id)}
                title="완료로 표시"
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Navigation section (Batch 5) ────────────────────────────────────
// Single block in the scene tab: toggles for pages/bookmarks/storyboard/
// templates + a "capture view" button that forwards into the bookmarks
// drawer's capture action for whichever page is active.
function NavigationSection() {
  const pagesOn = useFeature("nav.pages");
  const bookmarksOn = useFeature("nav.bookmarks");
  const storyboardOn = useFeature("nav.storyboard");
  const templatesOn = useFeature("nav.templates");
  const activePages = usePagesStore(s => s.pages);
  const activeId = usePagesStore(s => s.activeId);
  const bookmarks = useBookmarksStore(s => s.bookmarks);
  const forPage = bookmarksForPage({ bookmarks }, activeId);

  return (
    <>
      <div className="ws-debug__divider">내비게이션</div>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">페이지</span>
        <span className="ws-debug__v">
          {activePages.find(p => p.id === activeId)?.label ?? "—"}
          <span style={{ opacity: 0.6, marginLeft: 4 }}>
            (총 {activePages.length}개)
          </span>
        </span>
        <span className="ws-debug__k">뷰</span>
        <span className="ws-debug__v">{forPage.length}</span>
      </div>
      <div className="ws-debug__lod" style={{ gap: 2 }}>
        <label className="ws-debug__row" style={{ flex: 1 }}>
          <input
            type="checkbox"
            checked={pagesOn}
            onChange={e => featureFlagsStore.setFlag("nav.pages", e.target.checked)}
          />
          <span>페이지</span>
        </label>
        <label className="ws-debug__row" style={{ flex: 1 }}>
          <input
            type="checkbox"
            checked={bookmarksOn}
            onChange={e => featureFlagsStore.setFlag("nav.bookmarks", e.target.checked)}
          />
          <span>뷰</span>
        </label>
      </div>
      <div className="ws-debug__lod" style={{ gap: 2 }}>
        <label className="ws-debug__row" style={{ flex: 1 }}>
          <input
            type="checkbox"
            checked={storyboardOn}
            onChange={e => featureFlagsStore.setFlag("nav.storyboard", e.target.checked)}
          />
          <span>스토리보드</span>
        </label>
        <label className="ws-debug__row" style={{ flex: 1 }}>
          <input
            type="checkbox"
            checked={templatesOn}
            onChange={e => featureFlagsStore.setFlag("nav.templates", e.target.checked)}
          />
          <span>템플릿</span>
        </label>
      </div>
      <div className="ws-debug__lod" style={{ gap: 2 }}>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={() => captureCurrentBookmark(activeId)}
          disabled={!bookmarksOn}
          title="현재 카메라 + 필터를 활성 페이지의 북마크로 저장"
        >
          뷰 캡처
        </button>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={() => storyboardStore.start(activeId)}
          disabled={!storyboardOn || forPage.length === 0}
          title="이 페이지의 뷰들을 스토리보드로 재생"
        >
          투어 재생
        </button>
      </div>
    </>
  );
}

// ── Dev Mode section ────────────────────────────────────────────────
// Small control surface for the Batch 2 features. The inspector has no
// explicit toggle here — opening it is triggered by file selection, and
// the feature flag itself is the on/off knob in the Features tab.
function DevModeSection() {
  const hoverSummary = useFeature("devmode.hoverSummary");
  const measure = useFeature("devmode.measure");
  return (
    <>
      <div className="ws-debug__divider">개발자 모드</div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={hoverSummary}
          onChange={e => featureFlagsStore.setFlag("devmode.hoverSummary", e.target.checked)}
        />
        <span>호버 요약</span>
      </label>
      <div className="ws-debug__hint">
        측정 모드 (M 키){measure ? "" : " — 비활성"}: M 키 누른 채로 두 파일을 클릭하세요.
      </div>
    </>
  );
}

// ── Embeds section ──────────────────────────────────────────────────
// Aggregates the Batch 8 smart-embed HUD rows: pasted images, linked
// tickets (with source + state filter), open pull requests, and slack
// threads related to the currently-selected file.
const TICKET_SOURCES_HUD: readonly TicketSource[] = ["linear", "jira", "github"] as const;
const TICKET_STATES_HUD: readonly TicketState[] = ["todo", "in-progress", "in-review", "done"] as const;

function EmbedsSection() {
  const imagesOn = useFeature("embeds.imagePaste");
  const ticketsOn = useFeature("embeds.tickets");
  const prOn = useFeature("embeds.prBadge");
  const slackOn = useFeature("embeds.slackThread");
  return (
    <>
      <div className="ws-debug__divider">임베드</div>
      {imagesOn && <ImagesHudRow />}
      {ticketsOn && <TicketsHudRow />}
      {prOn && <PrsHudRow />}
      {slackOn && <SlackHudRow />}
      {!imagesOn && !ticketsOn && !prOn && !slackOn && (
        <div className="ws-debug__hint">모든 임베드 기능이 비활성 상태입니다.</div>
      )}
    </>
  );
}

function ImagesHudRow() {
  const images = useImagesStore(s => s.images);
  return (
    <>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">붙여넣은 이미지</span>
        <span className="ws-debug__v">
          {images.length} / {IMAGE_MAX_COUNT}
        </span>
      </div>
      <div className="ws-debug__hint">
        클립보드의 이미지를 캔버스에 붙여넣기 (⌘V) 하세요.
      </div>
      {images.length > 0 && (
        <div className="ws-debug__lod" style={{ gap: 2 }}>
          <button
            type="button"
            className="ws-debug__chip"
            onClick={() => imagesStore.reset()}
            title="붙여넣은 모든 이미지 제거"
          >
            모두 비우기
          </button>
        </div>
      )}
    </>
  );
}

function TicketsHudRow() {
  const [source, setSource] = useState<TicketSource | "all">("all");
  const [ticketState, setTicketState] = useState<TicketState | "all">("all");
  const byFile = useTicketLinksStore(s => s.byFile);

  const linkedIds = useMemo(() => {
    const s = new Set<string>();
    for (const ids of byFile.values()) for (const id of ids) s.add(id);
    return s;
  }, [byFile]);

  const rows = useMemo(() => {
    return listMockTickets().filter(t => {
      if (!linkedIds.has(t.id)) return false;
      if (source !== "all" && t.source !== source) return false;
      if (ticketState !== "all" && t.state !== ticketState) return false;
      return true;
    });
  }, [linkedIds, source, ticketState]);

  return (
    <>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">티켓</span>
        <span className="ws-debug__v">
          {rows.length} / {listMockTickets().length}
        </span>
      </div>
      <div className="ws-debug__lod" style={{ gap: 2 }}>
        <button
          type="button"
          className={`ws-debug__chip${source === "all" ? " is-on" : ""}`}
          onClick={() => setSource("all")}
        >
          전체
        </button>
        {TICKET_SOURCES_HUD.map(s => (
          <button
            key={s}
            type="button"
            className={`ws-debug__chip${source === s ? " is-on" : ""}`}
            onClick={() => setSource(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="ws-debug__lod" style={{ gap: 2 }}>
        <button
          type="button"
          className={`ws-debug__chip${ticketState === "all" ? " is-on" : ""}`}
          onClick={() => setTicketState("all")}
        >
          모두
        </button>
        {TICKET_STATES_HUD.map(s => (
          <button
            key={s}
            type="button"
            className={`ws-debug__chip${ticketState === s ? " is-on" : ""}`}
            onClick={() => setTicketState(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="ws-debug__hint">일치하는 티켓이 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
          {rows.map(t => (
            <div key={t.id} className="ws-debug__sticky-row" title={t.title}>
              <span className={`ws-ticket__src ws-ticket__src--${t.source}`} aria-hidden>
                {t.source.slice(0, 1).toUpperCase()}
              </span>
              <span className="ws-debug__sticky-text">
                {t.externalId} · {t.title}
              </span>
              <span className={`ws-ticket__state ws-ticket__state--${t.state}`}>{t.state}</span>
            </div>
          ))}
        </div>
      )}
      {linkedIds.size > 0 && (
        <div className="ws-debug__lod" style={{ gap: 2 }}>
          <button
            type="button"
            className="ws-debug__chip"
            onClick={() => ticketLinksStore.reset()}
            title="모든 티켓 링크 제거"
          >
            링크 비우기
          </button>
        </div>
      )}
    </>
  );
}

function PrsHudRow() {
  const graph = useSceneStore(s => s.graph);
  const prsByFile = useMemo(() => {
    if (!graph) return new Map<string, readonly ReturnType<typeof listMockPrs>[number][]>();
    return buildPrsByFile(graph.files.map(f => f.id));
  }, [graph]);
  const open = listMockPrs().filter(p => p.state === "open");
  const touchCount = (prNumber: number): number => {
    let n = 0;
    for (const row of prsByFile.values()) {
      if (row.some(p => p.number === prNumber)) n += 1;
    }
    return n;
  };
  return (
    <>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">풀 리퀘스트</span>
        <span className="ws-debug__v">
          {open.length} 오픈 · {listMockPrs().length - open.length} 병합됨
        </span>
      </div>
      {open.length === 0 ? (
        <div className="ws-debug__hint">목 픽스처에 오픈된 PR이 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
          {open.map(p => (
            <div key={p.number} className="ws-debug__sticky-row" title={p.title}>
              <span className="ws-pr-badge__num">#{p.number}</span>
              <span className="ws-debug__sticky-text">{p.title}</span>
              <span className="ws-debug__sticky-check" style={{ opacity: 0.7 }}>
                파일 {touchCount(p.number)}개
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SlackHudRow() {
  const graph = useSceneStore(s => s.graph);
  const selected = useInteractionStore(s => s.viewState.selectedFileId);
  const threads = useMemo(() => {
    const fileIds = graph?.files.map(f => f.id) ?? [];
    const allThreads = listMockSlackThreads();
    if (!selected) return allThreads;
    return allThreads.filter(t => {
      const fid = resolveSlackRelatedFileId(t, fileIds);
      return fid === selected;
    });
  }, [graph, selected]);
  return (
    <>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">관련 논의</span>
        <span className="ws-debug__v">{threads.length}</span>
      </div>
      {!selected && (
        <div className="ws-debug__hint">파일을 선택하면 필터링됩니다. 현재는 모든 스레드를 표시 중입니다.</div>
      )}
      {threads.length === 0 ? (
        <div className="ws-debug__hint">관련 스레드가 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          {threads.map(t => (
            <SlackEmbed key={t.id} thread={t} />
          ))}
        </div>
      )}
    </>
  );
}
