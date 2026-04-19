import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  FileEdge,
  FileNode,
  WorkspaceGraph,
  EdgeKind,
} from "@quanta/canvas-engine";
import { useSceneStore } from "../store/scene-store";
import { useInteractionStore, interactionStore } from "../store/interaction-store";
import { useFeature } from "../store/feature-flags-store";
import { toMermaidDiagram, toDotGraph, toShareUrl } from "../lib/export-helpers";
import { showToast, showSuccessToast, showErrorToast } from "../lib/toast";

// Right-sidebar Dev Mode inspector. Mirrors the Figma "properties panel"
// but scoped to software-intelligence signals: incoming/outgoing edges,
// centrality rank, function complexity, evidence hits, side-effects,
// latency, blame summary, and (gated) a copy-as drawer.
//
// Designed to never mutate interactionStore beyond selectFile — the panel
// reacts to `viewState.selectedFileId` and writes back only when the user
// clicks a neighbour row.

const LAYER_BADGE_COLOR: Record<string, string> = {
  domain: "#db2777",
  adapter: "#4f46e5",
  infra: "#16a34a",
  ui: "#d97706",
  util: "#6b7280",
  unknown: "#9ca3af",
};

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

interface EdgeBucket {
  kind: EdgeKind;
  count: number;
  topFiles: string[]; // peer file ids — sources for inbound, targets for outbound
}

function collectEdges(
  edges: readonly FileEdge[],
  fileId: string,
  direction: "in" | "out",
): EdgeBucket[] {
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
  const out: EdgeBucket[] = [];
  for (const [kind, entry] of byKind) {
    const topFiles = [...entry.peers.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, 5)
      .map(([id]) => id);
    out.push({ kind, count: entry.count, topFiles });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

function countEvidence(edges: readonly FileEdge[], fileId: string): number {
  let n = 0;
  for (const e of edges) {
    if (!e.evidenceId) continue;
    if (e.from === fileId || e.to === fileId) n += 1;
  }
  return n;
}

function blameTopAuthors(
  graph: WorkspaceGraph | null,
  fileId: string,
): Array<{ name: string; lines: number }> {
  const blame = graph?.blame?.[fileId];
  if (!blame) return [];
  const tally = new Map<string, number>();
  for (const entry of blame.entries) {
    const span = Math.max(0, entry.endLine - entry.startLine + 1);
    tally.set(entry.author, (tally.get(entry.author) ?? 0) + span);
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, lines]) => ({ name, lines }));
}

interface SectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}
function Section({ title, count, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ws-inspector__section">
      <button
        type="button"
        className="ws-inspector__section-head"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <span className="ws-inspector__section-caret">{open ? "v" : ">"}</span>
        <span className="ws-inspector__section-title">{title}</span>
        {typeof count === "number" && (
          <span className="ws-inspector__section-count">{count}</span>
        )}
      </button>
      {open && <div className="ws-inspector__section-body">{children}</div>}
    </div>
  );
}

function NeighborList({
  peers,
  files,
  onPick,
}: {
  peers: readonly string[];
  files: Map<string, FileNode>;
  onPick: (id: string) => void;
}) {
  if (peers.length === 0) return <div className="ws-inspector__hint">none</div>;
  return (
    <ul className="ws-inspector__neighbors">
      {peers.map(id => {
        const f = files.get(id);
        return (
          <li key={id}>
            <button
              type="button"
              className="ws-inspector__neighbor"
              onClick={() => onPick(id)}
              title={id}
            >
              <span
                className="ws-inspector__layer-dot"
                style={{ background: LAYER_BADGE_COLOR[f?.layer ?? "unknown"] }}
              />
              <span className="ws-inspector__neighbor-name">{basename(id)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CopyAsSection({ file }: { file: FileNode }) {
  const layout = useSceneStore(s => s.layout);
  const visible = useSceneStore(s => s.visibleScene);

  // Copy-as feedback routes through the shared toast store so a Cmd+C
  // on the inspector stacks predictably with engine / export toasts.
  const copy = useCallback(
    async (value: string, label: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
          showSuccessToast(`Copied ${label}`);
        } else {
          window.prompt(`copy ${label}`, value);
          showToast("Copy manually");
        }
      } catch {
        showErrorToast("Copy failed");
      }
    },
    [],
  );

  const copyPath = useCallback(() => { void copy(file.id, "path"); }, [copy, file.id]);
  const copyShare = useCallback(() => { void copy(toShareUrl(), "share URL"); }, [copy]);
  const copyMermaid = useCallback(() => {
    if (!layout || !visible) { showToast("No scene"); return; }
    void copy(toMermaidDiagram({ layout, visible }), "Mermaid");
  }, [copy, layout, visible]);
  const copyDot = useCallback(() => {
    if (!layout || !visible) { showToast("No scene"); return; }
    void copy(toDotGraph({ layout, visible }), "DOT");
  }, [copy, layout, visible]);

  return (
    <Section title="Copy as" defaultOpen={false}>
      <div className="ws-inspector__copyas">
        <button type="button" className="ws-inspector__btn" onClick={copyPath}>path</button>
        <button type="button" className="ws-inspector__btn" onClick={copyShare}>share URL</button>
        <button type="button" className="ws-inspector__btn" onClick={copyMermaid}>mermaid</button>
        <button type="button" className="ws-inspector__btn" onClick={copyDot}>DOT</button>
      </div>
    </Section>
  );
}

export function InspectorPanel() {
  const enabled = useFeature("devmode.inspector");
  const copyAsEnabled = useFeature("devmode.copyAs");
  const selectedFileId = useInteractionStore(s => s.viewState.selectedFileId);
  const graph = useSceneStore(s => s.graph);
  const layout = useSceneStore(s => s.layout);

  const fileById = useMemo(() => {
    const m = new Map<string, FileNode>();
    if (graph) for (const f of graph.files) m.set(f.id, f);
    return m;
  }, [graph]);

  const file = selectedFileId ? fileById.get(selectedFileId) ?? null : null;
  const open = enabled && !!file;

  // Esc dismisses the panel. Mirrors the EvidencePanel behaviour so power
  // users can bail without reaching for the mouse.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        interactionStore.selectFile(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const inboundBuckets = useMemo(() => {
    if (!file || !graph) return [];
    return collectEdges(graph.fileEdges, file.id, "in");
  }, [file, graph]);

  const outboundBuckets = useMemo(() => {
    if (!file || !graph) return [];
    return collectEdges(graph.fileEdges, file.id, "out");
  }, [file, graph]);

  const inboundTotal = inboundBuckets.reduce((s, b) => s + b.count, 0);
  const outboundTotal = outboundBuckets.reduce((s, b) => s + b.count, 0);

  const evidenceCount = useMemo(() => {
    if (!file || !graph) return 0;
    return countEvidence(graph.fileEdges, file.id);
  }, [file, graph]);

  const firstEvidenceEdge = useMemo(() => {
    if (!file || !graph) return null;
    return graph.fileEdges.find(
      e => e.evidenceId && (e.from === file.id || e.to === file.id),
    ) ?? null;
  }, [file, graph]);

  const metrics = file ? layout?.metrics?.perFile.get(file.id) : undefined;
  const degreeRank = useMemo(() => {
    if (!file || !layout?.metrics) return null;
    const idx = layout.metrics.topByDegree.indexOf(file.id);
    return idx >= 0 ? idx + 1 : null;
  }, [file, layout]);
  const betweennessRank = useMemo(() => {
    if (!file || !layout?.metrics) return null;
    const idx = layout.metrics.topByBetweenness.indexOf(file.id);
    return idx >= 0 ? idx + 1 : null;
  }, [file, layout]);

  const effects = file ? graph?.effects?.[file.id] : undefined;
  const latency = file ? graph?.latency?.[file.id] : undefined;
  const blameAuthors = useMemo(() => {
    if (!file) return [];
    return blameTopAuthors(graph, file.id);
  }, [file, graph]);

  const pickFile = useCallback((id: string) => {
    interactionStore.selectFile(id);
  }, []);

  const openEvidence = useCallback(() => {
    if (firstEvidenceEdge?.evidenceId) {
      interactionStore.setInspectedEvidence(firstEvidenceEdge.evidenceId);
    }
  }, [firstEvidenceEdge]);

  if (!open || !file) return null;

  const riskPct = Math.round(file.riskScore * 100);

  return (
    <aside className="ws-inspector" role="complementary" aria-label="Inspector">
      <div className="ws-inspector__header">
        <div className="ws-inspector__header-main">
          <span
            className="ws-inspector__layer-badge"
            style={{ background: LAYER_BADGE_COLOR[file.layer] }}
          >
            {file.layer}
          </span>
          <span className="ws-inspector__filename" title={file.id}>{basename(file.id)}</span>
        </div>
        <button
          type="button"
          className="ws-inspector__close"
          onClick={() => interactionStore.selectFile(null)}
          title="Close (Esc)"
        >×</button>
      </div>

      <div className="ws-inspector__body">
        <Section title="Header" defaultOpen>
          <div className="ws-inspector__grid">
            <span className="ws-inspector__k">path</span>
            <span className="ws-inspector__v ws-inspector__mono" title={file.id}>{file.id}</span>
            <span className="ws-inspector__k">size</span>
            <span className="ws-inspector__v">{file.loc.toLocaleString()} loc</span>
            <span className="ws-inspector__k">risk</span>
            <span className="ws-inspector__v">
              <span className="ws-inspector__risk-bar">
                <span className="ws-inspector__risk-fill" style={{ width: `${riskPct}%` }} />
              </span>
              <span className="ws-inspector__risk-num">{riskPct}</span>
            </span>
          </div>
        </Section>

        <Section title="Inbound edges" count={inboundTotal} defaultOpen>
          {inboundBuckets.length === 0 ? (
            <div className="ws-inspector__hint">no inbound edges</div>
          ) : (
            inboundBuckets.map(bucket => (
              <div key={bucket.kind} className="ws-inspector__bucket">
                <div className="ws-inspector__bucket-head">
                  <span className="ws-inspector__bucket-kind">{bucket.kind}</span>
                  <span className="ws-inspector__bucket-count">{bucket.count}</span>
                </div>
                <NeighborList peers={bucket.topFiles} files={fileById} onPick={pickFile} />
              </div>
            ))
          )}
        </Section>

        <Section title="Outbound edges" count={outboundTotal} defaultOpen={false}>
          {outboundBuckets.length === 0 ? (
            <div className="ws-inspector__hint">no outbound edges</div>
          ) : (
            outboundBuckets.map(bucket => (
              <div key={bucket.kind} className="ws-inspector__bucket">
                <div className="ws-inspector__bucket-head">
                  <span className="ws-inspector__bucket-kind">{bucket.kind}</span>
                  <span className="ws-inspector__bucket-count">{bucket.count}</span>
                </div>
                <NeighborList peers={bucket.topFiles} files={fileById} onPick={pickFile} />
              </div>
            ))
          )}
        </Section>

        <Section title="Centrality" defaultOpen={false}>
          <div className="ws-inspector__grid">
            <span className="ws-inspector__k">degree</span>
            <span className="ws-inspector__v">
              {metrics ? `${metrics.degree} (in ${metrics.inDegree} / out ${metrics.outDegree})` : "—"}
              {degreeRank && <span className="ws-inspector__rank"> · #{degreeRank}</span>}
            </span>
            <span className="ws-inspector__k">betweenness</span>
            <span className="ws-inspector__v">
              {metrics?.betweennessRank !== undefined ? metrics.betweennessRank.toFixed(3) : "—"}
              {betweennessRank && <span className="ws-inspector__rank"> · #{betweennessRank}</span>}
            </span>
          </div>
        </Section>

        <Section title="Functions" count={file.functions.length} defaultOpen={false}>
          {file.functions.length === 0 ? (
            <div className="ws-inspector__hint">no parsed functions</div>
          ) : (
            <ul className="ws-inspector__fns">
              {file.functions.map(fn => (
                <li key={fn.name} className="ws-inspector__fn">
                  <span className="ws-inspector__fn-name">{fn.name}</span>
                  <span
                    className="ws-inspector__fn-cpx"
                    title={`complexity ${fn.complexity}`}
                  >cpx {fn.complexity}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Evidence" count={evidenceCount} defaultOpen={false}>
          {evidenceCount === 0 ? (
            <div className="ws-inspector__hint">no evidenced edges touching this file</div>
          ) : (
            <button
              type="button"
              className="ws-inspector__btn"
              onClick={openEvidence}
              disabled={!firstEvidenceEdge}
            >
              open EvidencePanel
            </button>
          )}
        </Section>

        <Section title="Effects + Latency" defaultOpen={false}>
          <div className="ws-inspector__chips">
            {effects?.effects.length
              ? effects.effects.map(k => (
                  <span key={k} className="ws-inspector__chip">{k}</span>
                ))
              : <span className="ws-inspector__hint">no observed effects</span>}
          </div>
          <div className="ws-inspector__grid" style={{ marginTop: 6 }}>
            <span className="ws-inspector__k">p50</span>
            <span className="ws-inspector__v">{latency ? `${latency.p50}ms` : "—"}</span>
            <span className="ws-inspector__k">p95</span>
            <span className="ws-inspector__v">{latency ? `${latency.p95}ms` : "—"}</span>
            <span className="ws-inspector__k">p99</span>
            <span className="ws-inspector__v">{latency ? `${latency.p99}ms` : "—"}</span>
          </div>
        </Section>

        <Section title="Blame" defaultOpen={false}>
          {blameAuthors.length === 0 ? (
            <div className="ws-inspector__hint">no blame data</div>
          ) : (
            <ul className="ws-inspector__blame">
              {blameAuthors.map(a => (
                <li key={a.name}>
                  <span className="ws-inspector__blame-name">{a.name}</span>
                  <span className="ws-inspector__blame-lines">{a.lines} ln</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {copyAsEnabled && <CopyAsSection file={file} />}
      </div>
    </aside>
  );
}
