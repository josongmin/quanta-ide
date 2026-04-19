import { useMemo } from "react";
import type { FileMetrics, WorkspaceMetrics, FileEdge, Trace, TraceSpan, FileLatency, FileEffects } from "@quanta/canvas-engine";
import { latencyColor } from "@quanta/canvas-engine";
import { useSceneStore } from "../../store/scene-store";
import { interactionStore, useInteractionStore } from "../../store/interaction-store";
import { DebtTrajectoryChart } from "../DebtTrajectoryChart";

// "graph" HUD tab — surfaces centrality metrics computed by
// `computeWorkspaceMetrics` alongside layout. Shows:
//   - top N files by degree (always available)
//   - top N files by betweenness (only when computed)
//   - total file/edge count
//   - compute-time readout (sampled flag when applicable)
//
// Values are sourced from `layout.metrics` so any renderer or HUD surface
// sees the same authoritative ranking.

const TOP_N = 10;

function shortName(id: string): string {
  // Display only the leaf (filename) so the ranked list stays readable at
  // HUD widths. Hovering the row reveals the full path via `title`.
  const parts = id.split("/");
  return parts[parts.length - 1] || id;
}

export function GraphSection() {
  const layout = useSceneStore(s => s.layout);
  const metrics: WorkspaceMetrics | undefined = layout?.metrics;

  // Memoize per-file lookups for the rendered rows so re-renders of the HUD
  // during panning don't re-scan perFile for each slice.
  const degRows = useMemo(() => {
    if (!metrics) return [] as Array<{ id: string; m: FileMetrics }>;
    return metrics.topByDegree.slice(0, TOP_N).map(id => ({
      id,
      m: metrics.perFile.get(id) ?? { inDegree: 0, outDegree: 0, degree: 0 },
    }));
  }, [metrics]);

  const btwRows = useMemo(() => {
    if (!metrics) return [] as Array<{ id: string; m: FileMetrics }>;
    return metrics.topByBetweenness.slice(0, TOP_N).map(id => ({
      id,
      m: metrics.perFile.get(id) ?? { inDegree: 0, outDegree: 0, degree: 0 },
    }));
  }, [metrics]);

  if (!metrics) {
    return <GraphEmptyState />;
  }

  const hasBetweenness = btwRows.length > 0;

  return (
    <>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">파일</span>
        <span className="ws-debug__v">{metrics.fileCount.toLocaleString()}</span>

        <span className="ws-debug__k">엣지</span>
        <span className="ws-debug__v">{metrics.edgeCount.toLocaleString()}</span>

        <span className="ws-debug__k">계산 시간</span>
        <span className="ws-debug__v">
          {metrics.computeMs.toFixed(1)}ms
          {metrics.betweennessSampled ? " (샘플)" : ""}
        </span>
      </div>

      <div className="ws-debug__divider">차수 상위</div>
      <div className="ws-debug__grid">
        {degRows.length === 0 && (
          <>
            <span className="ws-debug__k" style={{ gridColumn: "1 / -1", opacity: 0.6 }}>
              — 비어 있음 —
            </span>
          </>
        )}
        {degRows.map(({ id, m }, i) => (
          <TopRow
            key={`deg-${id}`}
            rank={i + 1}
            id={id}
            primary={`${m.degree}`}
            secondary={`${m.inDegree} 인 / ${m.outDegree} 아웃`}
          />
        ))}
      </div>

      {hasBetweenness && (
        <>
          <div className="ws-debug__divider">매개 중심성 상위</div>
          <div className="ws-debug__grid">
            {btwRows.map(({ id, m }, i) => (
              <TopRow
                key={`btw-${id}`}
                rank={i + 1}
                id={id}
                primary={((m.betweennessRank ?? 0) * 100).toFixed(1) + "%"}
                secondary={`차수 ${m.degree}`}
              />
            ))}
          </div>
        </>
      )}

      <GraphSources />

      {/* Traces — runtime captured call paths. Radio-style chip row lets the
          user flip the canvas overlay between [none] and each captured trace.
          Active trace expands into a small summary (total duration + top N
          self-time spans) so the reader can navigate the flame-map without
          leaving the HUD. */}
      <TracesList />

      {/* SCC section — import/call cycles surfaced by Tarjan's SCC pass. Each
          row is the first 3 member basenames + overflow count. Click to
          select the first member so the user can zoom to the cycle. */}
      <SCCList />

      {/* Start-here ranking — AI-assist "you should look here first" list.
          Mirrors the in-canvas badges but with full filenames + score
          breakdown. Click to select. */}
      <StartHereList />

      {/* Hot paths — top files by p95 latency + files with ≥3 observed
          side effects. Mirrors Sentry Performance / Datadog Service Map
          file lists. Click a row → camera pans to the file. */}
      <HotPathsSection />

      {/* Debt trajectory — timeseries of sccCount + arch violations across
          recorded history. Click a point to jump the temporal scrubber to
          that commit. Feature-gated on `archaeology.debtTrajectory`. */}
      <DebtTrajectoryChart />
    </>
  );
}

function SCCList() {
  const sccs = useSceneStore(s => s.layout?.sccs);
  if (!sccs || sccs.length === 0) return null;
  const shown = sccs.slice(0, 10);
  return (
    <>
      <div className="ws-debug__divider">사이클 ({sccs.length})</div>
      <div className="ws-debug__grid">
        {shown.map((members, i) => {
          const head = members.slice(0, 3).map(shortName).join(", ");
          const more = members.length > 3 ? ` +${members.length - 3}` : "";
          return (
            <div
              key={`scc-${i}`}
              className="ws-debug__row"
              style={{ gridColumn: "1 / -1", cursor: "pointer" }}
              onClick={() => interactionStore.selectFile(members[0])}
              title={members.join("\n")}
            >
              <span style={{ opacity: 0.7, marginRight: 6 }}>{i + 1}.</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                {head}{more}
              </span>
              <span style={{ color: "#ea580c", fontVariantNumeric: "tabular-nums" }}>
                ·{members.length}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function StartHereList() {
  const startHere = useSceneStore(s => s.layout?.startHere);
  if (!startHere || startHere.length === 0) return null;
  return (
    <>
      <div className="ws-debug__divider">시작점 ({startHere.length})</div>
      <div className="ws-debug__grid">
        {startHere.slice(0, 10).map(entry => (
          <div
            key={`sh-${entry.fileId}`}
            className="ws-debug__row"
            style={{ gridColumn: "1 / -1", cursor: "pointer" }}
            onClick={() => interactionStore.selectFile(entry.fileId)}
            title={`${entry.fileId}\n중심성 ${(entry.breakdown.centrality * 100).toFixed(0)}% · 진입점 ${(entry.breakdown.entryPoint * 100).toFixed(0)}% · 리스크 ${(entry.breakdown.risk * 100).toFixed(0)}%`}
          >
            <span
              style={{
                display: "inline-block",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#6366f1",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                textAlign: "center",
                lineHeight: "18px",
                marginRight: 6,
              }}
            >
              {entry.rank}
            </span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
              {shortName(entry.fileId)}
            </span>
            <span style={{ opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>
              {(entry.score * 100).toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

const GRAPH_COLORS: Record<string, number> = {
  main: 0x3b82f6,
  auth: 0xf59e0b,
  default: 0x6b7280,
};

interface GraphBucket {
  graphId: string;
  label: string;
  color: string;
  fileCount: number;
  edgeCount: number;
}

function toCss(hex: number): string {
  return "#" + hex.toString(16).padStart(6, "0");
}

function GraphSources() {
  const graph = useSceneStore(s => s.graph);
  const rows = useMemo<{ buckets: GraphBucket[]; joinsByKind: Record<string, number>; totalJoins: number }>(() => {
    const buckets = new Map<string, GraphBucket>();
    let totalJoins = 0;
    const joinsByKind: Record<string, number> = {};
    if (!graph) return { buckets: [], joinsByKind, totalJoins };
    for (const file of graph.files) {
      const id = file.graphId ?? "default";
      const existing = buckets.get(id);
      if (existing) {
        existing.fileCount += 1;
      } else {
        buckets.set(id, {
          graphId: id,
          label: id,
          color: toCss(GRAPH_COLORS[id] ?? GRAPH_COLORS.default),
          fileCount: 1,
          edgeCount: 0,
        });
      }
    }
    for (const edge of graph.fileEdges as readonly FileEdge[]) {
      if (edge.crossGraph) {
        totalJoins += 1;
        joinsByKind[edge.kind] = (joinsByKind[edge.kind] ?? 0) + 1;
        continue;
      }
      const id = edge.graphId ?? "default";
      const bucket = buckets.get(id);
      if (bucket) bucket.edgeCount += 1;
    }
    return { buckets: [...buckets.values()], joinsByKind, totalJoins };
  }, [graph]);

  if (rows.buckets.length <= 1 && rows.totalJoins === 0) return null;

  return (
    <>
      <div className="ws-debug__divider">그래프 소스</div>
      <div className="ws-debug__grid">
        {rows.buckets.map(b => (
          <div
            key={`gs-${b.graphId}`}
            className="ws-debug__row"
            style={{ gridColumn: "1 / -1", cursor: "pointer" }}
            onClick={() => interactionStore.flashGraph(b.graphId)}
            title={`${b.label} 파일을 2초간 플래시`}
          >
            <span
              style={{
                display: "inline-block",
                width: 8, height: 8, borderRadius: "50%",
                background: b.color, marginRight: 8,
              }}
            />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{b.label}</span>
            <span style={{ opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>
              파일 {b.fileCount}개, 엣지 {b.edgeCount}개
            </span>
          </div>
        ))}
        {rows.totalJoins > 0 && (
          <div className="ws-debug__row" style={{ gridColumn: "1 / -1" }}>
            <span style={{ opacity: 0.75, marginRight: 8 }}>조인:</span>
            <span style={{ flex: 1, fontVariantNumeric: "tabular-nums" }}>
              {rows.totalJoins}
            </span>
            <span style={{ opacity: 0.6, fontSize: 11 }}>
              {Object.entries(rows.joinsByKind).map(([k, v]) => `${v} ${k}`).join(", ")}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

function TracesList() {
  const pack = useSceneStore(s => s.graph?.traces);
  const activeTraceId = useInteractionStore(s => s.activeTraceId);
  // Stabilize the fallback empty array so the memo below doesn't re-fire
  // every render when `pack` is undefined.
  const traces = useMemo(() => pack?.traces ?? [], [pack]);
  const active = useMemo<Trace | null>(() => {
    if (!activeTraceId) return null;
    return traces.find(t => t.id === activeTraceId) ?? null;
  }, [activeTraceId, traces]);

  if (traces.length === 0) return null;

  const setTrace = (id: string | null) => interactionStore.setActiveTrace(id);

  return (
    <>
      <div className="ws-debug__divider">트레이스 ({traces.length})</div>
      {/* Chip row — [none] + one chip per trace. Radio semantics: exactly
          one "is-on" at any time (may be "none"). */}
      <div className="ws-debug__row" style={{ flexWrap: "wrap", gap: 4 }}>
        <button
          type="button"
          className={`ws-debug__chip${activeTraceId === null ? " is-on" : ""}`}
          onClick={() => setTrace(null)}
          title="트레이스 오버레이 제거"
        >
          없음
        </button>
        {traces.map(t => (
          <button
            key={t.id}
            type="button"
            className={`ws-debug__chip${activeTraceId === t.id ? " is-on" : ""}`}
            onClick={() => setTrace(t.id)}
            title={`${t.label} · ${t.totalMs}ms · 스팬 ${t.spans.length}개 · 수집 ${new Date(t.capturedAt).toLocaleDateString()}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Full trace catalogue — label / duration / span count / capturedAt.
          Click to activate the trace (mirrors the chip row; redundancy is
          intentional because chips truncate long labels in tight HUD widths). */}
      <div className="ws-debug__grid">
        {traces.map(t => {
          const isOn = activeTraceId === t.id;
          return (
            <div
              key={`trow-${t.id}`}
              className="ws-debug__row"
              style={{
                gridColumn: "1 / -1",
                cursor: "pointer",
                background: isOn ? "rgba(34, 211, 238, 0.12)" : "transparent",
                padding: isOn ? "4px 6px" : "2px 6px",
                borderRadius: 4,
              }}
              onClick={() => setTrace(isOn ? null : t.id)}
              title={t.id}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                {t.label}
              </span>
              <span style={{ opacity: 0.75, fontVariantNumeric: "tabular-nums", marginLeft: 6 }}>
                {t.totalMs}ms · 스팬 {t.spans.length}개
              </span>
            </div>
          );
        })}
      </div>

      {active && <TraceSpanDetails trace={active} />}
    </>
  );
}

function TraceSpanDetails({ trace }: { trace: Trace }) {
  // Top-5 spans by self-time — the flame-map convention for "where the time
  // actually went" (excluding children). Falls back to durationMs when
  // selfMs is missing.
  const topSpans = useMemo<TraceSpan[]>(() => {
    const ranked = [...trace.spans].sort((a, b) => {
      const sa = a.selfMs ?? a.durationMs;
      const sb = b.selfMs ?? b.durationMs;
      return sb - sa;
    });
    return ranked.slice(0, 5);
  }, [trace]);

  const onSpanClick = (span: TraceSpan) => {
    interactionStore.selectFile(span.fileId);
    // If the span has a symbol, the future line-scroll hook will pick this
    // up from selectedFileId + selectedSymbol. Today the file selection
    // alone is enough to focus the canvas on the right card.
  };

  return (
    <>
      <div className="ws-debug__grid" style={{ marginTop: 4 }}>
        <span className="ws-debug__k">트레이스</span>
        <span className="ws-debug__v">{trace.label}</span>
        <span className="ws-debug__k">총</span>
        <span className="ws-debug__v">{trace.totalMs}ms</span>
        <span className="ws-debug__k">스팬</span>
        <span className="ws-debug__v">{trace.spans.length}</span>
        <span className="ws-debug__k">엣지</span>
        <span className="ws-debug__v">{trace.edges.length}</span>
      </div>
      <div className="ws-debug__divider">자체 시간 상위 스팬</div>
      <div className="ws-debug__grid">
        {topSpans.map((span, i) => {
          const self = span.selfMs ?? span.durationMs;
          const leaf = span.fileId.split("/").pop() ?? span.fileId;
          const label = span.symbol ? `${leaf} · ${span.symbol}` : leaf;
          return (
            <div
              key={`tspan-${i}-${span.fileId}`}
              className="ws-debug__row"
              style={{ gridColumn: "1 / -1", cursor: "pointer" }}
              onClick={() => onSpanClick(span)}
              title={`${span.fileId}${span.symbol ? ` · ${span.symbol}` : ""}\n깊이 ${span.depth} · 시작 ${span.startMs}ms · 지속 ${span.durationMs}ms`}
            >
              <span style={{ opacity: 0.7, marginRight: 6, fontVariantNumeric: "tabular-nums" }}>
                {i + 1}.
              </span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                {label}
              </span>
              <span style={{ color: "#22d3ee", fontVariantNumeric: "tabular-nums" }}>
                {self}ms
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function toHex(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}

function HotPathsSection() {
  const graph = useSceneStore(s => s.graph);
  const latency = graph?.latency;
  const effects = graph?.effects;

  const hotByLatency = useMemo<Array<[string, FileLatency]>>(() => {
    if (!latency) return [];
    return Object.entries(latency)
      .sort(([, a], [, b]) => b.p95 - a.p95)
      .slice(0, 5);
  }, [latency]);

  const mostEffected = useMemo<Array<[string, FileEffects]>>(() => {
    if (!effects) return [];
    return Object.entries(effects)
      .filter(([, e]) => e.effects.length >= 3)
      .sort(([, a], [, b]) => b.effects.length - a.effects.length)
      .slice(0, 10);
  }, [effects]);

  if (hotByLatency.length === 0 && mostEffected.length === 0) return null;

  return (
    <>
      {hotByLatency.length > 0 && (
        <>
          <div className="ws-debug__divider">핫 패스 (p95)</div>
          <div className="ws-debug__grid">
            {hotByLatency.map(([id, ent], i) => (
              <div
                key={`hp-${id}`}
                className="ws-debug__row"
                style={{ gridColumn: "1 / -1", cursor: "pointer" }}
                onClick={() => interactionStore.selectFile(id)}
                title={`${id}\np50 ${ent.p50}ms · p95 ${ent.p95}ms · p99 ${ent.p99}ms · ${ent.callCount}/분`}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: toHex(latencyColor(ent.p95)),
                    marginRight: 8,
                  }}
                />
                <span style={{ opacity: 0.7, marginRight: 6, fontVariantNumeric: "tabular-nums" }}>
                  {i + 1}.
                </span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {shortName(id)}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                  {ent.p95}ms
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {mostEffected.length > 0 && (
        <>
          <div className="ws-debug__divider">이펙트가 많은 파일</div>
          <div className="ws-debug__grid">
            {mostEffected.map(([id, ent]) => (
              <div
                key={`me-${id}`}
                className="ws-debug__row"
                style={{ gridColumn: "1 / -1", cursor: "pointer" }}
                onClick={() => interactionStore.selectFile(id)}
                title={`${id}\n이펙트: ${ent.effects.join(", ")}`}
              >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {shortName(id)}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.75 }}>
                  {ent.effects.length} 종류
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function GraphEmptyState() {
  // Layout is computed automatically once the graph is mounted — the
  // most common reason the metrics panel is empty is "no graph selected
  // yet" or "still loading". We surface both gracefully and offer a
  // one-click fit so the user can see the canvas react.
  const graph = useSceneStore(s => s.graph);
  const progress = useSceneStore(s => s.layoutProgress);
  const stage = progress?.stage ?? "idle";
  const computing =
    stage === "requested" ||
    stage === "grid-ready" ||
    stage === "elk-running";
  const hasGraph = (graph?.files.length ?? 0) > 0;

  const label = computing
    ? "레이아웃 계산 중…"
    : hasGraph
      ? "아직 메트릭이 없습니다"
      : "로드된 그래프가 없습니다";
  const hint = computing
    ? `${progress?.filesCount ?? 0}개 파일 처리 중 — 곧 중심성이 표시됩니다.`
    : hasGraph
      ? "워크스페이스 레이아웃을 실행하면 중심성·SCC·핫패스 순위가 보입니다."
      : "워크스페이스를 로드해서 그래프 뷰를 채워주세요.";

  return (
    <div className="ws-graph-empty" role="status">
      <div className="ws-graph-empty__title">{label}</div>
      <div className="ws-graph-empty__hint">{hint}</div>
    </div>
  );
}

function TopRow({
  rank,
  id,
  primary,
  secondary,
}: {
  rank: number;
  id: string;
  primary: string;
  secondary: string;
}) {
  return (
    <>
      <span
        className="ws-debug__k"
        style={{ paddingLeft: 4, fontVariantNumeric: "tabular-nums", opacity: 0.85 }}
        title={id}
      >
        {rank.toString().padStart(2, " ")}. {shortName(id)}
      </span>
      <span
        className="ws-debug__v"
        style={{ fontVariantNumeric: "tabular-nums" }}
        title={`${primary} · ${secondary}`}
      >
        <span style={{ fontWeight: 600 }}>{primary}</span>
        <span style={{ marginLeft: 6, opacity: 0.6 }}>{secondary}</span>
      </span>
    </>
  );
}
