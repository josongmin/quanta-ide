import { useMemo, useState } from "react";
import type {
  DriftFinding,
  FileEdge,
  SmellGenesis,
  SmellKind,
  CycleGenesis,
  SymbolMatch,
} from "@quanta/canvas-engine";
import {
  detectDrift,
  findCycleGenesis,
  findSmellGenesis,
  findSymbolFirstAppearance,
  materializeEdgeSet,
} from "@quanta/canvas-engine";
import { useSceneStore } from "../../store/scene-store";
import { interactionStore, useInteractionStore } from "../../store/interaction-store";
import { useFeature } from "../../store/feature-flags-store";
import { DebtTrajectoryChart } from "../DebtTrajectoryChart";

// Archaeology panel — surfaces the engine's temporal analysis for the current
// workspace. Groups four independent analyses under one collapsible panel so
// the HUD stays scannable while power users can drill into drift, cycle
// genesis, smell origin, and debt-over-time.
//
// Data wiring:
//   - drift:   current graph vs. earliest history snapshot (or current alone
//              as "before" if history is absent, which yields zero findings
//              — the panel then renders an empty state).
//   - cycle:   the SCC containing the currently-selected file, if any; falls
//              back to the first recorded SCC when nothing is selected.
//   - smell:   top-N smells resolved for the selected file; rotates through
//              all SmellKinds so users always see something meaningful when
//              data exists.
//   - debt:    delegates to the existing DebtTrajectoryChart so the visual
//              is consistent with the graph tab.
//
// Each sub-panel is individually feature-gated; the wrapper itself is gated
// on `archaeology.panel` so we can hide the whole thing when the Software
// Intelligence features are disabled for a repo.

const DRIFT_LIMIT = 10;
const SMELL_LIMIT = 8;
const SMELL_KINDS: readonly SmellKind[] = [
  "cycle-member",
  "high-coupling",
  "layer-violation",
  "risk-spike",
];

const SEVERITY_COLOR: Record<DriftFinding["severity"], string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22d3ee",
};

const DRIFT_KIND_LABEL: Record<DriftFinding["kind"], string> = {
  "layer-escalation": "레이어 상승",
  "fanout-explosion": "팬아웃 폭증",
  "new-cycle-member": "새 사이클 멤버",
  "ownership-shift": "오너십 이동",
};

const SMELL_LABEL: Record<SmellKind, string> = {
  "high-coupling": "고결합",
  "cycle-member": "사이클 멤버",
  "risk-spike": "리스크 급증",
  "layer-violation": "레이어 위반",
};

function shortName(id: string): string {
  const parts = id.split("/");
  return parts[parts.length - 1] || id;
}

export function ArchaeologyPanel() {
  const enabled = useFeature("archaeology.panel");
  const [open, setOpen] = useState(true);

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        className="ws-debug__divider"
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          font: "inherit",
          padding: "4px 0 2px",
          color: "inherit",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 10,
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 120ms ease",
            fontSize: 9,
          }}
        >
          ▶
        </span>
        <span>archaeology</span>
      </button>
      {open && (
        <>
          <DriftFindings />
          <CycleGenesisBlock />
          <SmellGenesisBlock />
          <SymbolFirstAppearanceBlock />
          <DebtTrajectoryBlock />
        </>
      )}
    </>
  );
}

function DriftFindings() {
  const on = useFeature("archaeology.driftDetector");
  const graph = useSceneStore(s => s.graph);
  const sccs = useSceneStore(s => s.layout?.sccs);

  // "before" is the earliest recorded snapshot's edge set restricted to the
  // current file catalogue — good enough for surfacing the common drift
  // signals without requiring the engine to carry two full snapshots.
  const findings = useMemo<readonly DriftFinding[]>(() => {
    if (!on || !graph) return [];
    const history = graph.history;
    if (!history || history.snapshots.length === 0) return [];
    const edgeIndex = new Map<string, FileEdge>();
    for (const e of graph.fileEdges) edgeIndex.set(e.id, e);
    const baseIds = materializeEdgeSet(history, 0);
    const beforeEdges: FileEdge[] = [];
    for (const id of baseIds) {
      const e = edgeIndex.get(id);
      if (e) beforeEdges.push(e);
    }
    return detectDrift(
      { files: graph.files, fileEdges: beforeEdges, sccs: [] },
      { files: graph.files, fileEdges: graph.fileEdges, sccs },
    );
  }, [on, graph, sccs]);

  if (!on) return null;

  const shown = findings.slice(0, DRIFT_LIMIT);

  return (
    <>
      <div className="ws-debug__divider">drift findings ({findings.length})</div>
      {!graph?.history || graph.history.snapshots.length === 0 ? (
        <div className="ws-debug__hint">히스토리가 없어 드리프트를 비교할 수 없습니다.</div>
      ) : shown.length === 0 ? (
        <div className="ws-debug__hint">드리프트가 감지되지 않았습니다.</div>
      ) : (
        <div className="ws-debug__grid">
          {shown.map((f, i) => (
            <div
              key={`drift-${i}-${f.fileId}`}
              className="ws-debug__row"
              style={{ gridColumn: "1 / -1" }}
              onClick={() => interactionStore.selectFile(f.fileId)}
              title={`${f.fileId}\n${f.detail}`}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: SEVERITY_COLOR[f.severity],
                  marginRight: 6,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {shortName(f.fileId)}
              </span>
              <span style={{ opacity: 0.75, fontSize: 10, marginLeft: 6 }}>
                {DRIFT_KIND_LABEL[f.kind]}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function CycleGenesisBlock() {
  const on = useFeature("archaeology.cycleGenesis");
  const graph = useSceneStore(s => s.graph);
  const sccs = useSceneStore(s => s.layout?.sccs);
  const selectedFileId = useInteractionStore(s => s.viewState.selectedFileId);

  // Prefer the SCC that contains the current selection; fall back to the
  // first SCC so users still see an example when nothing is selected.
  const activeScc = useMemo<readonly string[] | null>(() => {
    if (!sccs || sccs.length === 0) return null;
    if (selectedFileId) {
      const hit = sccs.find(s => s.includes(selectedFileId));
      if (hit) return hit;
    }
    return sccs[0];
  }, [sccs, selectedFileId]);

  const genesis = useMemo<CycleGenesis | null>(() => {
    if (!on || !graph || !graph.history || !activeScc) return null;
    const edgeIndex = new Map<string, FileEdge>();
    for (const e of graph.fileEdges) edgeIndex.set(e.id, e);
    return findCycleGenesis(activeScc, graph.history, edgeIndex);
  }, [on, graph, activeScc]);

  if (!on) return null;

  return (
    <>
      <div className="ws-debug__divider">cycle genesis</div>
      {!graph?.history ? (
        <div className="ws-debug__hint">히스토리 소스가 연결되지 않았습니다.</div>
      ) : !activeScc ? (
        <div className="ws-debug__hint">사이클이 없습니다 — SCC를 선택하면 형성 커밋이 표시됩니다.</div>
      ) : !genesis ? (
        <div className="ws-debug__hint">사이클 형성 커밋을 찾을 수 없습니다.</div>
      ) : (
        <div className="ws-debug__grid">
          <span className="ws-debug__k">멤버</span>
          <span className="ws-debug__v">
            {activeScc.slice(0, 3).map(shortName).join(", ")}
            {activeScc.length > 3 ? ` +${activeScc.length - 3}` : ""}
          </span>
          <span className="ws-debug__k">형성 커밋</span>
          <span className="ws-debug__v">
            {genesis.formedAtSha ? genesis.formedAtSha.slice(0, 7) : "(baseline)"}
          </span>
          {genesis.introducingEdge && (
            <>
              <span className="ws-debug__k">닫힌 엣지</span>
              <span className="ws-debug__v">
                {shortName(genesis.introducingEdge.from)} → {shortName(genesis.introducingEdge.to)}
                <span style={{ opacity: 0.6, marginLeft: 4 }}>({genesis.introducingEdge.kind})</span>
              </span>
            </>
          )}
          {genesis.formedAtTimestamp !== undefined && (
            <>
              <span className="ws-debug__k">시각</span>
              <span className="ws-debug__v">
                {new Date(genesis.formedAtTimestamp).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
      )}
    </>
  );
}

interface SmellRow {
  kind: SmellKind;
  genesis: SmellGenesis;
}

function SmellGenesisBlock() {
  const on = useFeature("archaeology.smellGenesis");
  const graph = useSceneStore(s => s.graph);
  const selectedFileId = useInteractionStore(s => s.viewState.selectedFileId);

  const rows = useMemo<readonly SmellRow[]>(() => {
    if (!on || !graph || !graph.history || !selectedFileId) return [];
    const out: SmellRow[] = [];
    for (const kind of SMELL_KINDS) {
      const g = findSmellGenesis(selectedFileId, kind, graph.history, {
        files: graph.files,
        fileEdges: graph.fileEdges,
      });
      if (g) out.push({ kind, genesis: g });
    }
    // Sort recent-first so "top-N recent findings" actually reflects recency.
    out.sort((a, b) => b.genesis.firstSeenTimestamp - a.genesis.firstSeenTimestamp);
    return out.slice(0, SMELL_LIMIT);
  }, [on, graph, selectedFileId]);

  if (!on) return null;

  return (
    <>
      <div className="ws-debug__divider">smell genesis</div>
      {!graph?.history ? (
        <div className="ws-debug__hint">히스토리 소스가 연결되지 않았습니다.</div>
      ) : !selectedFileId ? (
        <div className="ws-debug__hint">파일을 선택하면 스멜 기원이 표시됩니다.</div>
      ) : rows.length === 0 ? (
        <div className="ws-debug__hint">이 파일에서 추적된 스멜이 없습니다.</div>
      ) : (
        <div className="ws-debug__grid">
          {rows.map(({ kind, genesis }) => (
            <div
              key={`smell-${kind}`}
              className="ws-debug__row"
              style={{ gridColumn: "1 / -1" }}
              title={`${genesis.firstSeenSha}\n${new Date(genesis.firstSeenTimestamp).toLocaleString()}`}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                {SMELL_LABEL[kind]}
              </span>
              <span style={{ opacity: 0.75, fontSize: 10, marginLeft: 6, fontVariantNumeric: "tabular-nums" }}>
                {genesis.firstSeenSha.slice(0, 7)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SymbolFirstAppearanceBlock() {
  const on = useFeature("archaeology.symbolFirstAppearance");
  const graph = useSceneStore(s => s.graph);
  const [query, setQuery] = useState("");

  // Debounce-less live search — the engine routine walks snapshots
  // linearly and we cap results so even a one-char query stays cheap.
  // A real debounce can land later if repo sizes push the naive filter
  // past a frame budget.
  const matches = useMemo<readonly SymbolMatch[]>(() => {
    if (!on || !graph || !graph.history) return [];
    const q = query.trim();
    if (q.length < 2) return [];
    return findSymbolFirstAppearance(q, graph.history, {
      files: graph.files,
      fileEdges: graph.fileEdges,
    }, { limit: 12 });
  }, [on, graph, query]);

  if (!on) return null;

  const jumpTo = (match: SymbolMatch) => {
    // Rewind the temporal slider to the snapshot where the symbol first
    // appeared, select the file, and re-centre the viewport on it so the
    // archaeology block behaves like a navigation surface, not just a
    // read-only result list.
    interactionStore.selectFile(match.fileId);
    interactionStore.setTemporalMode("live");
    interactionStore.setSnapshotIndex(match.firstSnapshotIndex);
  };

  return (
    <>
      <div className="ws-debug__divider">symbol first-appearance</div>
      {!graph?.history ? (
        <div className="ws-debug__hint">히스토리 소스가 연결되지 않았습니다.</div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="함수/파일 이름 검색 (2자+)"
            className="ws-debug__input"
            style={{
              width: "100%",
              background: "rgba(148, 163, 184, 0.08)",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: 4,
              color: "#e2e8f0",
              padding: "4px 6px",
              fontSize: 11,
              outline: "none",
              marginTop: 2,
            }}
          />
          {query.trim().length >= 2 && matches.length === 0 && (
            <div className="ws-debug__hint">이 쿼리에 해당하는 심볼을 찾지 못했습니다.</div>
          )}
          {matches.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
              {matches.map(m => (
                <button
                  key={`${m.fileId}:${m.matchedName}:${m.kind}`}
                  type="button"
                  className="ws-debug__sticky-row"
                  onClick={() => jumpTo(m)}
                  title={`${m.firstCommitSha ?? "(no sha)"} · ${new Date(m.firstTimestamp).toLocaleString()}\n${m.firstSnapshotLabel}`}
                  style={{
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    padding: "2px 4px",
                    cursor: "pointer",
                    color: "inherit",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 26,
                      fontSize: 9,
                      opacity: 0.6,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {m.kind === "function" ? "fn" : "file"}
                  </span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.matchedName}
                  </span>
                  <span
                    style={{
                      opacity: 0.75,
                      fontSize: 10,
                      marginLeft: 6,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {m.firstCommitSha ? m.firstCommitSha.slice(0, 7) : `#${m.firstSnapshotIndex}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function DebtTrajectoryBlock() {
  // The chart component owns its own feature-gate (`archaeology.debtTrajectory`)
  // and history presence checks, so we just delegate. When disabled / empty
  // it renders nothing — we surface an explicit empty state instead so the
  // section never vanishes silently inside the archaeology panel.
  const on = useFeature("archaeology.debtTrajectory");
  const graph = useSceneStore(s => s.graph);
  if (!on) return null;
  if (!graph?.history || graph.history.snapshots.length === 0) {
    return (
      <>
        <div className="ws-debug__divider">debt trajectory</div>
        <div className="ws-debug__hint">히스토리가 없어 차트를 표시할 수 없습니다.</div>
      </>
    );
  }
  return <DebtTrajectoryChart />;
}
