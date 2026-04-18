import { useEffect, useState } from "react";
import type { TabAppProps } from "@quanta/shell-contract";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import {
  MultiFileCanvas,
  SAMPLE_GRAPH,
  loadRepoGraph,
  workspaceCanvasStore,
  setActiveGraphSource,
  type GraphSource,
  type LoadRepoResult,
} from "@quanta/app-ide/features/workspace-canvas";
import "./WorkspaceApp.css";

// ─── Engine integration TODO ─────────────────────────────────────────
// To swap the mock dev scanner for a real code-graph engine:
//   1. Implement `GraphSource` (see features/workspace-canvas/data/graph-source.ts).
//      e.g. `createEngineGraphSource({ endpoint: "grpc://…" })`.
//   2. Pass it in as `<WorkspaceApp graphSource={engineSource} />`.
//      The toolbar's path / presets / reset will then drive the engine
//      instead of the dev-server scanner; nothing else in the UI changes.
// ─────────────────────────────────────────────────────────────────────

// Presets: quick switches to repos we stress-test against.
const REPO_PRESETS: { label: string; path: string; exts?: string[]; max?: number }[] = [
  {
    label: "quanta-v2 (Rust, ~6k files)",
    path: "/Users/songmin/Documents/code-new/semantica-codegraph-v2/packages/analysis/quanta-v2",
    exts: [".rs"],
    max: 50000,
  },
  {
    label: "quanta-v2 · crates only",
    path: "/Users/songmin/Documents/code-new/semantica-codegraph-v2/packages/analysis/quanta-v2/crates",
    exts: [".rs"],
    max: 50000,
  },
];

const DEFAULT_PATH = REPO_PRESETS[0].path;
const DEFAULT_EXTS = ".rs,.ts,.tsx";
const DEFAULT_MAX = 50000; // hard cap purely to protect against accidental huge loads; scanner handles any count

type Status =
  | { kind: "idle" }
  | { kind: "loading"; path: string }
  | { kind: "loaded"; result: LoadRepoResult; path: string }
  | { kind: "error"; message: string };

export interface WorkspaceAppProps extends TabAppProps {
  /**
   * Optional adapter providing the WorkspaceGraph. When omitted, a
   * MockGraphSource backed by the dev-server scanner is used so existing
   * behavior is preserved bit-for-bit. Pass an engine-backed source in
   * production — see the top-of-file TODO.
   */
  graphSource?: GraphSource;
}

export function WorkspaceApp(props: WorkspaceAppProps) {
  const { graphSource: externalSource } = props;
  const [graph, setGraph] = useState<WorkspaceGraph>(SAMPLE_GRAPH);
  const [pathInput, setPathInput] = useState(DEFAULT_PATH);
  const [extsInput, setExtsInput] = useState(DEFAULT_EXTS);
  const [maxInput, setMaxInput] = useState(String(DEFAULT_MAX));
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [collapsed, setCollapsed] = useState(false);

  // Publish the active source so loaders (e.g. loadGroundData) can route
  // per-file reads through the engine's own channel when appropriate.
  useEffect(() => {
    if (externalSource) {
      setActiveGraphSource(externalSource);
      return () => setActiveGraphSource(null);
    }
    return undefined;
  }, [externalSource]);

  const load = async (path: string, exts?: string[], max?: number) => {
    setStatus({ kind: "loading", path });
    try {
      let graph: WorkspaceGraph;
      let stats: LoadRepoResult["stats"];
      if (externalSource) {
        // Route through the adapter. We still drive the toolbar inputs,
        // but the engine decides what path / exts / max mean.
        const t0 = performance.now();
        graph = await externalSource.loadGraph({ path, extensions: exts, maxFiles: max });
        stats = {
          totalFiles: graph.files.length,
          skipped: 0,
          durationMs: Math.round(performance.now() - t0),
        };
      } else {
        const result = await loadRepoGraph({ path, extensions: exts, maxFiles: max });
        graph = result.graph;
        stats = result.stats;
      }
      // Record the repo root BEFORE setGraph so any ground-card effects
      // that fire on the new graph see the correct root.
      workspaceCanvasStore.setRepoRoot(path);
      setGraph(graph);
      setStatus({ kind: "loaded", result: { graph, stats }, path });
    } catch (err) {
      setStatus({ kind: "error", message: String(err) });
    }
  };

  // ESC collapses the loader bar (useful while inspecting the canvas).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCollapsed(c => !c);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="workspace-app">
      {!collapsed && (
        <div className="workspace-app__toolbar">
          <div className="workspace-app__row">
            <span className="workspace-app__label">path</span>
            <input
              className="workspace-app__path"
              value={pathInput}
              onChange={e => setPathInput(e.target.value)}
              spellCheck={false}
              placeholder="/absolute/path/to/repo"
            />
            <span className="workspace-app__label">exts</span>
            <input
              className="workspace-app__exts"
              value={extsInput}
              onChange={e => setExtsInput(e.target.value)}
              spellCheck={false}
              placeholder=".rs,.ts,.tsx"
            />
            <span className="workspace-app__label">max</span>
            <input
              className="workspace-app__max"
              value={maxInput}
              onChange={e => setMaxInput(e.target.value)}
              inputMode="numeric"
            />
            <button
              type="button"
              className="workspace-app__btn"
              disabled={status.kind === "loading"}
              onClick={() => load(
                pathInput,
                extsInput.split(",").map(s => s.trim()).filter(Boolean),
                Number(maxInput) || undefined,
              )}
            >
              {status.kind === "loading" ? "loading…" : "load"}
            </button>
            <button
              type="button"
              className="workspace-app__btn workspace-app__btn--ghost"
              onClick={() => {
                workspaceCanvasStore.setRepoRoot(null);
                setGraph(SAMPLE_GRAPH);
                setStatus({ kind: "idle" });
              }}
            >
              reset
            </button>
          </div>
          <div className="workspace-app__row workspace-app__row--presets">
            <span className="workspace-app__label">presets</span>
            {REPO_PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                className="workspace-app__chip"
                onClick={() => {
                  setPathInput(p.path);
                  if (p.exts) setExtsInput(p.exts.join(","));
                  if (p.max) setMaxInput(String(p.max));
                  void load(p.path, p.exts, p.max);
                }}
              >
                {p.label}
              </button>
            ))}
            <span className="workspace-app__status">
              {status.kind === "loaded" &&
                `loaded ${status.result.stats.totalFiles} files · ${status.result.graph.fileEdges.length} edges · ${status.result.stats.durationMs}ms`}
              {status.kind === "error" && <span className="workspace-app__error">{status.message}</span>}
              {status.kind === "loading" && `scanning ${status.path}…`}
              {status.kind === "idle" && "showing built-in sample graph (press Esc to toggle toolbar)"}
            </span>
          </div>
        </div>
      )}
      <div className="workspace-app__canvas">
        <MultiFileCanvas graph={graph} />
      </div>
    </div>
  );
}
