import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  EdgeKind,
  FileEdge,
  FileNode,
  ProofBundle,
  WitnessRole,
} from "@quanta/canvas-engine";
import { useSceneStore } from "../store/scene-store";
import { useInteractionStore, interactionStore } from "../store/interaction-store";
import { useFeature } from "../store/feature-flags-store";
import {
  figmaModeStore,
  useFigmaMode,
  type FigmaModeState,
} from "../store/figma-mode-store";
import { roomFocusStore } from "../store/room-focus-store";
import { getAiService } from "../lib/ai-service-ref";
import { mockShaForSnapshot } from "../lib/mock-ai-service";
import type { NarrateCommitResult } from "../lib/ai-service";

// Figma-style right inspector (P0).
// -------------------------------------------------------------------
// Five tabs:
//
//   Summary    — identity, layer, loc, risk, role hints
//   Relations  — inbound / outbound edge buckets + co-change preview
//   Activity   — recent changes, authors, churn, incidents
//   AI         — narrator + explain-selection button
//   Evidence   — ProofBundle chain (reuses the existing contract)
//
// Shares the "selection-first" UX with the rest of the shell: the
// panel renders nothing meaningful without a selection and collapses
// to its tab column otherwise. A selection is currently a file id;
// follow-up P0-3 adds symbol selection through the same tab surface.

type RightTab = FigmaModeState["rightTab"];

const TAB_ORDER: readonly { id: RightTab; label: string; glyph: string }[] = [
  { id: "summary",   label: "Summary",   glyph: "○" },
  { id: "relations", label: "Relations", glyph: "↔" },
  { id: "activity",  label: "Activity",  glyph: "∿" },
  { id: "ai",        label: "AI",        glyph: "✦" },
  { id: "evidence",  label: "Evidence",  glyph: "⚖" },
];

export function FigmaRightInspector() {
  const enabled = useFeature("power.figmaShell");
  const open = useFigmaMode(s => s.rightOpen);
  const tab = useFigmaMode(s => s.rightTab);
  const selectedFileId = useInteractionStore(s => s.viewState.selectedFileId);
  const graph = useSceneStore(s => s.graph);
  const evidenceId = useInteractionStore(s => s.inspectedEvidenceId);

  const file = useMemo(() => {
    if (!selectedFileId || !graph) return null;
    return graph.files.find(f => f.id === selectedFileId) ?? null;
  }, [selectedFileId, graph]);

  // Auto-switch to Evidence tab when the user cmd+clicks an edge with
  // evidence. Mirrors Figma's "click = reveal relevant inspector section".
  useEffect(() => {
    if (evidenceId) figmaModeStore.setRightTab("evidence");
  }, [evidenceId]);

  if (!enabled) return null;

  const empty = !file && !evidenceId;

  return (
    <aside
      className={`ws-figma-right${open ? " is-open" : ""}`}
      aria-label="Inspector"
    >
      <div className="ws-figma-right__tabs" role="tablist">
        {TAB_ORDER.map(t => {
          const active = t.id === tab && open;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`ws-figma-right__tab${active ? " is-active" : ""}`}
              onClick={() => {
                if (active) figmaModeStore.setRightOpen(false);
                else figmaModeStore.setRightTab(t.id);
              }}
            >
              <span className="ws-figma-right__tab-glyph" aria-hidden>{t.glyph}</span>
              {open && <span className="ws-figma-right__tab-lbl">{t.label}</span>}
            </button>
          );
        })}
      </div>
      {open && (
        <div className="ws-figma-right__body">
          {empty ? (
            <EmptyState />
          ) : (
            <>
              {tab === "summary"   && <SummaryTab file={file} />}
              {tab === "relations" && <RelationsTab file={file} />}
              {tab === "activity"  && <ActivityTab file={file} />}
              {tab === "ai"        && <AiTab file={file} />}
              {tab === "evidence"  && <EvidenceTab />}
            </>
          )}
        </div>
      )}
    </aside>
  );
}

function EmptyState() {
  return (
    <div className="ws-figma-panel">
      <div className="ws-figma-panel__empty">
        <div className="ws-figma-panel__empty-title">Nothing selected</div>
        <div className="ws-figma-panel__empty-body">
          Click a file in the canvas to inspect it, or ⌘+click an edge to open evidence.
        </div>
      </div>
    </div>
  );
}

// ── Summary ───────────────────────────────────────────────────────

const LAYER_COLOR: Record<string, string> = {
  domain: "#db2777",
  adapter: "#4f46e5",
  infra: "#16a34a",
  ui: "#d97706",
  util: "#6b7280",
  unknown: "#9ca3af",
};

function basename(id: string): string {
  const i = id.lastIndexOf("/");
  return i >= 0 ? id.slice(i + 1) : id;
}

function SummaryTab({ file }: { file: FileNode | null }) {
  const layout = useSceneStore(s => s.layout);
  const graph = useSceneStore(s => s.graph);
  const metrics = file && layout?.metrics?.perFile.get(file.id);

  // Building-level: per-symbol fan-in/out. Count FileEdges whose
  // fromSymbol/toSymbol matches each function's name. This is a cheap
  // approximation (symbol anchors are string-matched, not AST-resolved)
  // but it surfaces the "public surface vs internal" split that the
  // Building layer of the design calls for.
  const symbolStats = useMemo(() => {
    if (!file || !graph) return new Map<string, { inbound: number; outbound: number }>();
    const stats = new Map<string, { inbound: number; outbound: number }>();
    for (const fn of file.functions) {
      stats.set(fn.name, { inbound: 0, outbound: 0 });
    }
    for (const e of graph.fileEdges) {
      if (e.to === file.id && e.toSymbol) {
        const s = stats.get(e.toSymbol);
        if (s) s.inbound += 1;
      }
      if (e.from === file.id && e.fromSymbol) {
        const s = stats.get(e.fromSymbol);
        if (s) s.outbound += 1;
      }
    }
    return stats;
  }, [file, graph]);

  const revealInCanvas = useCallback(() => {
    if (!file) return;
    const rect = layout?.fileRects.get(file.id);
    if (!rect) return;
    // Let the viewport hook handle the actual smooth-pan; we just fire
    // an interaction-store update that its watcher reacts to. Same path
    // the command palette uses.
    interactionStore.selectFile(file.id);
    figmaModeStore.setRightTab("summary");
  }, [file, layout]);

  if (!file) return null;

  const riskPct = Math.round(file.riskScore * 100);

  return (
    <div className="ws-figma-panel">
      <div className="ws-figma-panel__identity">
        <span
          className="ws-figma-panel__layer"
          style={{ background: LAYER_COLOR[file.layer] ?? LAYER_COLOR.unknown }}
        >
          {file.layer}
        </span>
        <span className="ws-figma-panel__title" title={file.id}>
          {basename(file.id)}
        </span>
      </div>
      <div className="ws-figma-panel__path" title={file.id}>{file.id}</div>

      <div className="ws-figma-panel__stats">
        <Stat label="LOC" value={file.loc.toLocaleString()} />
        <Stat
          label="Risk"
          value={
            <>
              <span className="ws-figma-panel__risk-bar">
                <span
                  className="ws-figma-panel__risk-fill"
                  style={{ width: `${riskPct}%` }}
                />
              </span>
              <span style={{ marginLeft: 6 }}>{riskPct}</span>
            </>
          }
        />
        <Stat
          label="Degree"
          value={metrics ? `${metrics.degree} (in ${metrics.inDegree} / out ${metrics.outDegree})` : "—"}
        />
        <Stat
          label="Betweenness"
          value={metrics?.betweennessRank !== undefined ? metrics.betweennessRank.toFixed(3) : "—"}
        />
        <Stat label="Functions" value={file.functions.length.toString()} />
      </div>

      {file.functions.length > 0 && (
        <div className="ws-figma-panel__section">
          <div className="ws-figma-panel__section-head">
            Public surface <span className="ws-figma-panel__section-meta">{file.functions.length}</span>
          </div>
          <div className="ws-figma-panel__list">
            {file.functions.slice(0, 10).map(fn => {
              const st = symbolStats.get(fn.name);
              const inbound = st?.inbound ?? 0;
              const outbound = st?.outbound ?? 0;
              const isEntry = inbound > 0 && outbound === 0;
              const isLeaf = outbound > 0 && inbound === 0;
              const roleTag = isEntry ? "entry" : isLeaf ? "leaf" : inbound + outbound > 0 ? "internal" : "local";
              return (
                <button
                  key={fn.name}
                  type="button"
                  className="ws-figma-row"
                  onClick={() => file && roomFocusStore.focus(file.id, fn.name)}
                  title={`Open Room flow for ${fn.name} · cpx ${fn.complexity}`}
                >
                  <span className="ws-figma-row__lbl" style={{ fontFamily: "var(--figma-mono)" }}>
                    {fn.name}
                  </span>
                  <span className="ws-figma-row__meta" style={{ display: "flex", gap: 6 }}>
                    <span title="inbound / outbound symbol refs">
                      ↓{inbound} ↑{outbound}
                    </span>
                    <span
                      style={{
                        padding: "0 4px",
                        borderRadius: 2,
                        background:
                          roleTag === "entry"
                            ? "rgba(34,197,94,0.18)"
                            : roleTag === "leaf"
                              ? "rgba(245,158,11,0.18)"
                              : "rgba(148,163,184,0.15)",
                        color:
                          roleTag === "entry"
                            ? "#86efac"
                            : roleTag === "leaf"
                              ? "#fbbf24"
                              : "#94a3b8",
                        fontSize: 9,
                        textTransform: "uppercase",
                      }}
                    >
                      {roleTag}
                    </span>
                  </span>
                </button>
              );
            })}
            {file.functions.length > 10 && (
              <div className="ws-figma-panel__hint">(+{file.functions.length - 10} more)</div>
            )}
          </div>
        </div>
      )}

      <div className="ws-figma-panel__section">
        <div className="ws-figma-panel__section-head">Actions</div>
        <div className="ws-figma-panel__chips">
          <button
            type="button"
            className="ws-figma-chip"
            onClick={revealInCanvas}
            title="Re-center the canvas on this file"
          >
            Reveal in canvas
          </button>
          <button
            type="button"
            className="ws-figma-chip"
            onClick={() => interactionStore.setFocusMode("on")}
          >
            Expand neighborhood
          </button>
          <button
            type="button"
            className="ws-figma-chip"
            onClick={() => figmaModeStore.setLeftTab("focus")}
          >
            Open focus panel
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ws-figma-panel__stat">
      <div className="ws-figma-panel__stat-k">{label}</div>
      <div className="ws-figma-panel__stat-v">{value}</div>
    </div>
  );
}

// ── Relations ─────────────────────────────────────────────────────

interface Bucket {
  kind: EdgeKind;
  count: number;
  peers: string[];
}

function collectEdges(
  edges: readonly FileEdge[],
  fileId: string,
  direction: "in" | "out",
): Bucket[] {
  const byKind = new Map<EdgeKind, { count: number; peers: Map<string, number> }>();
  for (const e of edges) {
    if (direction === "in" && e.to !== fileId) continue;
    if (direction === "out" && e.from !== fileId) continue;
    let entry = byKind.get(e.kind);
    if (!entry) { entry = { count: 0, peers: new Map() }; byKind.set(e.kind, entry); }
    entry.count += 1;
    const peer = direction === "in" ? e.from : e.to;
    entry.peers.set(peer, (entry.peers.get(peer) ?? 0) + 1);
  }
  const out: Bucket[] = [];
  for (const [kind, entry] of byKind) {
    const peers = [...entry.peers.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, 5)
      .map(([id]) => id);
    out.push({ kind, count: entry.count, peers });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

function RelationsTab({ file }: { file: FileNode | null }) {
  const graph = useSceneStore(s => s.graph);
  const inbound = useMemo(
    () => (file && graph ? collectEdges(graph.fileEdges, file.id, "in") : []),
    [file, graph],
  );
  const outbound = useMemo(
    () => (file && graph ? collectEdges(graph.fileEdges, file.id, "out") : []),
    [file, graph],
  );

  if (!file) return null;
  const totalIn = inbound.reduce((s, b) => s + b.count, 0);
  const totalOut = outbound.reduce((s, b) => s + b.count, 0);

  return (
    <div className="ws-figma-panel">
      <BucketBlock title="Inbound" total={totalIn} buckets={inbound} />
      <BucketBlock title="Outbound" total={totalOut} buckets={outbound} />
    </div>
  );
}

function BucketBlock({
  title, total, buckets,
}: {
  title: string;
  total: number;
  buckets: Bucket[];
}) {
  return (
    <div className="ws-figma-panel__section">
      <div className="ws-figma-panel__section-head">
        {title} <span className="ws-figma-panel__section-meta">{total}</span>
      </div>
      {buckets.length === 0 ? (
        <div className="ws-figma-panel__hint">no edges</div>
      ) : (
        buckets.map(b => (
          <div key={b.kind} className="ws-figma-panel__bucket">
            <div className="ws-figma-panel__bucket-head">
              <span className="ws-figma-panel__bucket-kind">{b.kind}</span>
              <span className="ws-figma-panel__bucket-count">{b.count}</span>
            </div>
            <div className="ws-figma-panel__list">
              {b.peers.map(p => (
                <button
                  key={p}
                  type="button"
                  className="ws-figma-row"
                  onClick={() => interactionStore.selectFile(p)}
                  title={p}
                >
                  <span className="ws-figma-row__lbl">{basename(p)}</span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Activity ──────────────────────────────────────────────────────

function ActivityTab({ file }: { file: FileNode | null }) {
  const graph = useSceneStore(s => s.graph);
  const history = graph?.history;
  const blame = file ? graph?.blame?.[file.id] : undefined;

  const recentSnapshots = useMemo(() => {
    if (!file || !history) return [];
    // Snapshots whose added/removed set contains an edge involving this file.
    const touched: { idx: number; label: string; when: number; author?: string; message?: string }[] = [];
    const edgeById = new Map<string, FileEdge>();
    for (const e of graph!.fileEdges) edgeById.set(e.id, e);
    for (let i = 0; i < history.snapshots.length; i++) {
      const s = history.snapshots[i];
      const ids = [...(s.added ?? []), ...(s.removed ?? [])];
      const hit = ids.some(eid => {
        const edge = edgeById.get(eid);
        if (!edge) return false;
        return edge.from === file.id || edge.to === file.id;
      });
      if (hit) {
        touched.push({
          idx: i,
          label: s.label,
          when: s.timestamp,
          author: s.author,
          message: s.message,
        });
      }
    }
    return touched.slice(-8).reverse();
  }, [file, history, graph]);

  if (!file) return null;

  const topAuthors = blame ? topBlameAuthors(blame) : [];

  return (
    <div className="ws-figma-panel">
      <div className="ws-figma-panel__section">
        <div className="ws-figma-panel__section-head">Recent touches</div>
        {recentSnapshots.length === 0 ? (
          <div className="ws-figma-panel__hint">No commits touching this file yet.</div>
        ) : (
          <div className="ws-figma-panel__list">
            {recentSnapshots.map(s => (
              <button
                key={s.idx}
                type="button"
                className="ws-figma-row"
                onClick={() => {
                  interactionStore.setTemporalMode("live");
                  interactionStore.setSnapshotIndex(s.idx);
                }}
                title={s.message ?? s.label}
              >
                <span className="ws-figma-row__lbl">{s.message ?? s.label}</span>
                <span className="ws-figma-row__meta">
                  {s.author ?? "?"} · {new Date(s.when).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ws-figma-panel__section">
        <div className="ws-figma-panel__section-head">Top authors</div>
        {topAuthors.length === 0 ? (
          <div className="ws-figma-panel__hint">No blame data.</div>
        ) : (
          <div className="ws-figma-panel__list">
            {topAuthors.map(a => (
              <div key={a.name} className="ws-figma-row">
                <span className="ws-figma-row__lbl">{a.name}</span>
                <span className="ws-figma-row__meta">{a.lines} lines</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function topBlameAuthors(blame: { entries: readonly { author: string; endLine: number; startLine: number }[] }): { name: string; lines: number }[] {
  const counts = new Map<string, number>();
  for (const entry of blame.entries) {
    const span = Math.max(1, entry.endLine - entry.startLine + 1);
    counts.set(entry.author, (counts.get(entry.author) ?? 0) + span);
  }
  return [...counts.entries()]
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5);
}

// ── AI ────────────────────────────────────────────────────────────

function AiTab({ file }: { file: FileNode | null }) {
  const graph = useSceneStore(s => s.graph);
  const temporalIdx = useInteractionStore(s => s.temporal.snapshotIndex);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NarrateCommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async () => {
    if (!graph || !graph.history) return;
    const sha = mockShaForSnapshot(graph.history, temporalIdx);
    if (!sha) return;
    setLoading(true);
    setError(null);
    try {
      const svc = getAiService();
      const res = await svc.narrateCommit({ sha, graph, history: graph.history });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [graph, temporalIdx]);

  return (
    <div className="ws-figma-panel">
      <div className="ws-figma-panel__section">
        <div className="ws-figma-panel__section-head">Commit narrator</div>
        <div className="ws-figma-panel__hint">
          Explain the commit at the current temporal slider position
          {file && ` through the lens of ${basename(file.id)}`}.
        </div>
        <div className="ws-figma-panel__chips" style={{ marginTop: 6 }}>
          <button
            type="button"
            className="ws-figma-chip"
            onClick={() => void ask()}
            disabled={loading || !graph?.history}
          >
            {loading ? "Thinking…" : "Ask AI"}
          </button>
          {result && (
            <button
              type="button"
              className="ws-figma-chip"
              onClick={() => setResult(null)}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="ws-figma-panel__section">
          <div className="ws-figma-panel__hint" style={{ color: "#ef4444" }}>{error}</div>
        </div>
      )}
      {result && (
        <div className="ws-figma-panel__section">
          <div className="ws-figma-panel__section-head">Summary</div>
          <div className="ws-figma-panel__prose">{result.summary}</div>
          {result.highlights.length > 0 && (
            <ul className="ws-figma-panel__ul">
              {result.highlights.map(h => <li key={h}>{h}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Evidence ──────────────────────────────────────────────────────

const ROLE_COLOR: Record<WitnessRole, string> = {
  source: "#dc2626",
  sink: "#b91c1c",
  propagation: "#ea580c",
  "sanitizer-bypass": "#d97706",
  flow: "#6b7280",
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#dc2626",
  critical: "#7f1d1d",
};

function EvidenceTab() {
  const evidenceId = useInteractionStore(s => s.inspectedEvidenceId);
  const proofs = useSceneStore(s => s.graph?.proofs);
  const proof: ProofBundle | null = evidenceId ? proofs?.[evidenceId] ?? null : null;

  // Active step — the user can walk through the trace one step at a
  // time with ←/→ once the panel is open. Default to the last step
  // (sink) so the headline payload lands at the most severe location.
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    if (!proof) return;
    setActiveStep(proof.steps.length - 1);
  }, [proof]);

  useEffect(() => {
    if (!proof) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveStep(s => Math.max(0, s - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveStep(s => Math.min(proof.steps.length - 1, s + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [proof]);

  if (!proof) {
    return (
      <div className="ws-figma-panel">
        <div className="ws-figma-panel__empty">
          <div className="ws-figma-panel__empty-title">No evidence open</div>
          <div className="ws-figma-panel__empty-body">
            ⌘+click an edge with an evidence badge to trace it.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ws-figma-panel">
      <div className="ws-figma-panel__section">
        <div className="ws-figma-panel__identity">
          <span
            className="ws-figma-panel__layer"
            style={{ background: SEVERITY_COLOR[proof.severity] ?? "#6b7280" }}
          >
            {proof.severity}
          </span>
          <span className="ws-figma-panel__title">{proof.kind}</span>
        </div>
        {proof.rule && <div className="ws-figma-panel__path">{proof.rule}</div>}
        <div className="ws-figma-panel__prose">{proof.summary}</div>
        <div className="ws-figma-panel__hint">
          analyzer · {proof.analyzer}
          {typeof proof.confidence === "number" && ` · ${(proof.confidence * 100).toFixed(0)}% confidence`}
        </div>
      </div>
      <div className="ws-figma-panel__section">
        <div className="ws-figma-panel__section-head">
          Trace <span className="ws-figma-panel__section-meta">{proof.steps.length} steps</span>
        </div>
        <div className="ws-figma-panel__chips">
          <button
            type="button"
            className="ws-figma-chip"
            onClick={() => setActiveStep(s => Math.max(0, s - 1))}
            disabled={activeStep <= 0}
            title="Walk backward (←)"
          >
            ← back
          </button>
          <span className="ws-figma-panel__hint" style={{ alignSelf: "center", margin: "0 4px" }}>
            step {activeStep + 1} / {proof.steps.length}
          </span>
          <button
            type="button"
            className="ws-figma-chip"
            onClick={() => setActiveStep(s => Math.min(proof.steps.length - 1, s + 1))}
            disabled={activeStep >= proof.steps.length - 1}
            title="Walk forward (→)"
          >
            forward →
          </button>
        </div>
        <div className="ws-figma-evidence__rail">
          {proof.steps.map((step, idx) => (
            <div
              key={step.stepId}
              className="ws-figma-evidence__step"
              style={{
                borderColor: idx === activeStep ? ROLE_COLOR[step.role] : undefined,
                boxShadow: idx === activeStep
                  ? `0 0 0 1px ${ROLE_COLOR[step.role]}`
                  : undefined,
                opacity: idx === activeStep ? 1 : 0.75,
              }}
              onClick={() => setActiveStep(idx)}
              role="button"
              tabIndex={0}
            >
              <div className="ws-figma-evidence__step-head">
                <span className="ws-figma-evidence__step-num">{idx + 1}</span>
                <span
                  className="ws-figma-evidence__step-role"
                  style={{ background: ROLE_COLOR[step.role] }}
                >
                  {step.role}
                </span>
                <span className="ws-figma-evidence__step-loc" title={step.file}>
                  {basename(step.file)}
                  {step.line && `:${step.line}`}
                  {step.symbol && ` · ${step.symbol}`}
                </span>
              </div>
              {step.snippet && (
                <pre className="ws-figma-evidence__snippet">{step.snippet}</pre>
              )}
              <div className="ws-figma-evidence__step-desc">{step.description}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="ws-figma-panel__section">
        <button
          type="button"
          className="ws-figma-chip"
          onClick={() => interactionStore.setInspectedEvidence(null)}
        >
          Close trace
        </button>
      </div>
    </div>
  );
}
