import type { WorkspaceGraph, EdgeKind } from "./types";

// Tarjan's strongly-connected components over the file-level graph.
//
// Strongly-connected components (SCCs) in an import/call graph are cycles —
// each non-trivial SCC means the files inside it mutually depend on each
// other, which is a classic defect pattern (Structure101 / NDepend /
// SonarGraph all surface this as a first-class finding). We need SCCs to
// power the orange "cycle bubble" overlay at the galaxy tier.
//
// Implementation notes:
//   - Iterative — recursive Tarjan blows the JS stack on graphs around
//     5k+ nodes (v8's default stack is ~10k frames and each DFS step
//     consumes 2-3). The iterative form uses an explicit work-stack with
//     a per-frame "next neighbour index" so we can suspend/resume.
//   - Default `includeKinds = {"import","call"}`. Cycles in dataflow or
//     taint have different semantics (taint cycles often mean fixpoints,
//     dataflow cycles often mean legitimate feedback loops) — surfacing
//     *structural* cycles is what users expect when we show a "cycle"
//     badge. Callers can override to widen the lens.
//   - Trivial SCCs (a single node without a self-loop) are omitted from
//     `components` because they add O(V) noise for no user value; the
//     `componentOf` map is likewise sparse.

export interface SCCResult {
  /** Each entry is a component (array of fileIds). Trivial SCCs (size=1 without self-loop) are omitted. */
  components: readonly (readonly string[])[];
  /** fileId → component index (into `components`). Missing entries belong to a trivial SCC. */
  componentOf: Map<string, number>;
}

const DEFAULT_INCLUDE_KINDS: ReadonlySet<EdgeKind> = new Set<EdgeKind>(["import", "call"]);

export function findStronglyConnectedComponents(
  graph: Pick<WorkspaceGraph, "fileEdges">,
  opts?: { includeKinds?: ReadonlySet<EdgeKind> },
): SCCResult {
  const includeKinds = opts?.includeKinds ?? DEFAULT_INCLUDE_KINDS;

  // Build directed adjacency restricted to the requested kinds. We also
  // record whether a node has a self-loop so a size-1 SCC containing a
  // self-loop is still reported (it's a cycle of length 1).
  const adj = new Map<string, string[]>();
  const selfLoop = new Set<string>();
  const ensure = (id: string): string[] => {
    let list = adj.get(id);
    if (!list) {
      list = [];
      adj.set(id, list);
    }
    return list;
  };
  for (const e of graph.fileEdges) {
    if (!includeKinds.has(e.kind)) continue;
    ensure(e.from).push(e.to);
    ensure(e.to);
    if (e.from === e.to) selfLoop.add(e.from);
  }

  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  let nextIndex = 0;

  const components: string[][] = [];
  const componentOf = new Map<string, number>();

  // Each work-stack frame carries the DFS node + the index of its next
  // outgoing neighbour to process. When a child call "returns" we resume
  // at the parent by updating its lowlink and advancing its cursor.
  interface Frame { v: string; neighIdx: number; neighbours: string[]; }
  const work: Frame[] = [];

  const nodes = Array.from(adj.keys());
  for (const root of nodes) {
    if (index.has(root)) continue;

    index.set(root, nextIndex);
    lowlink.set(root, nextIndex);
    nextIndex += 1;
    stack.push(root);
    onStack.add(root);
    work.push({ v: root, neighIdx: 0, neighbours: adj.get(root) ?? [] });

    while (work.length > 0) {
      const frame = work[work.length - 1];
      if (frame.neighIdx < frame.neighbours.length) {
        const w = frame.neighbours[frame.neighIdx++];
        const wIdx = index.get(w);
        if (wIdx === undefined) {
          // Descend into w — classic Tarjan recurse.
          index.set(w, nextIndex);
          lowlink.set(w, nextIndex);
          nextIndex += 1;
          stack.push(w);
          onStack.add(w);
          work.push({ v: w, neighIdx: 0, neighbours: adj.get(w) ?? [] });
        } else if (onStack.has(w)) {
          // Back-edge into the current DFS stack — tightens lowlink.
          const cur = lowlink.get(frame.v)!;
          if (wIdx < cur) lowlink.set(frame.v, wIdx);
        }
        // else: cross-edge to a settled SCC — ignore.
      } else {
        // Finished all neighbours: pop this frame and propagate lowlink
        // upward (equivalent to returning from the recursive call).
        work.pop();
        const v = frame.v;
        const vIdx = index.get(v)!;
        const vLow = lowlink.get(v)!;
        if (vLow === vIdx) {
          const comp: string[] = [];
          for (;;) {
            const node = stack.pop()!;
            onStack.delete(node);
            comp.push(node);
            if (node === v) break;
          }
          // Omit trivial SCCs — size 1 without a self-loop is a non-cycle.
          if (comp.length > 1 || (comp.length === 1 && selfLoop.has(comp[0]))) {
            const idx = components.length;
            for (const n of comp) componentOf.set(n, idx);
            components.push(comp);
          }
        } else if (work.length > 0) {
          const parent = work[work.length - 1];
          const parentLow = lowlink.get(parent.v)!;
          if (vLow < parentLow) lowlink.set(parent.v, vLow);
        }
      }
    }
  }

  return { components, componentOf };
}
