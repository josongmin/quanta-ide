import type { FunctionBlock, WorkspaceGraph } from "@quanta/canvas-engine";

// Room flow (R3)
// -------------------------------------------------------------------
// Function-internal flow is the Room layer in the 9-level design.
// Without an AST-diff engine we can't do true CFG/DFG, but the graph
// already carries *symbol anchors* on every structural edge
// (`fromSymbol`/`toSymbol`), which gives us an approximation that's
// accurate for the "who calls this function?" and "what does this
// function call?" questions — the primary pain points the design
// calls out for this layer.
//
// Output:
//   - The file's declared functions, ordered by startLine.
//   - Outgoing call edges — where `fromSymbol === fn.name` on an edge
//     leaving the file, we record the downstream {targetFile,
//     targetSymbol} pair.
//   - Incoming call edges — mirror: edges arriving at this file with
//     `toSymbol === fn.name`.
//   - Internal calls — edges whose `from` and `to` are the same file
//     and both `fromSymbol` / `toSymbol` are populated.
//
// `side effects` approximation: edges of kind `effect` leaving the
// function are classified as side-effectful.

export interface RoomCall {
  edgeId: string;
  kind: string;
  peerFileId: string;
  peerSymbol: string | null;
  /** Approx source line inside the function. */
  line: number | null;
}

export interface RoomSymbolNode {
  name: string;
  startLine: number;
  endLine: number;
  complexity: number;
  /** Calls into this function from elsewhere. */
  inbound: readonly RoomCall[];
  /** Calls out of this function — dedup by (peerFileId, peerSymbol). */
  outbound: readonly RoomCall[];
  /** Same-file calls to other functions inside this file. */
  internal: readonly RoomCall[];
  /** Side-effect edges leaving this function. */
  effects: readonly RoomCall[];
  /** True when this function appears to only have outbound edges — the
   *  analogue of the design's "entry point" tag. */
  looksLikeEntry: boolean;
  /** True when only inbound edges — likely a leaf / helper. */
  looksLikeLeaf: boolean;
}

export interface RoomFlow {
  fileId: string;
  symbols: readonly RoomSymbolNode[];
  /** Lines not claimed by any function — usually top-level code. */
  topLevelEdgeCount: number;
}

function inside(fn: FunctionBlock, line: number | undefined): boolean {
  if (line === undefined) return false;
  return line >= fn.startLine && line <= fn.endLine;
}

/**
 * Compute the Room flow for a single file. Returns a structured
 * per-symbol breakdown the UI can render as a small SVG graph.
 */
export function computeRoomFlow(
  graph: Pick<WorkspaceGraph, "files" | "fileEdges">,
  fileId: string,
): RoomFlow | null {
  const file = graph.files.find(f => f.id === fileId);
  if (!file) return null;
  if (file.functions.length === 0) {
    return { fileId, symbols: [], topLevelEdgeCount: 0 };
  }

  // Sort functions ascending so line lookups short-circuit quickly.
  const fns = [...file.functions].sort((a, b) => a.startLine - b.startLine);

  const buckets: Record<string, {
    inbound: RoomCall[];
    outbound: RoomCall[];
    internal: RoomCall[];
    effects: RoomCall[];
  }> = {};
  for (const fn of fns) {
    buckets[fn.name] = { inbound: [], outbound: [], internal: [], effects: [] };
  }

  const effectKinds = new Set(["effect", "dataflow", "taint-propagation"]);

  let topLevelEdgeCount = 0;
  for (const e of graph.fileEdges) {
    const leaves = e.from === fileId;
    const arrives = e.to === fileId;
    if (!leaves && !arrives) continue;

    if (leaves) {
      const owner = e.fromSymbol && buckets[e.fromSymbol]
        ? buckets[e.fromSymbol]
        : resolveByLine(fns, e.fromLine, buckets);
      if (!owner) {
        topLevelEdgeCount += 1;
        continue;
      }
      const call: RoomCall = {
        edgeId: e.id,
        kind: e.kind,
        peerFileId: e.to,
        peerSymbol: e.toSymbol ?? null,
        line: e.fromLine ?? null,
      };
      if (effectKinds.has(e.kind)) {
        owner.effects.push(call);
      }
      if (e.to === fileId) {
        owner.internal.push(call);
      } else {
        owner.outbound.push(call);
      }
    }
    if (arrives && !leaves) {
      const owner = e.toSymbol && buckets[e.toSymbol]
        ? buckets[e.toSymbol]
        : resolveByLine(fns, e.toLine, buckets);
      if (!owner) continue;
      owner.inbound.push({
        edgeId: e.id,
        kind: e.kind,
        peerFileId: e.from,
        peerSymbol: e.fromSymbol ?? null,
        line: e.toLine ?? null,
      });
    }
  }

  const symbols: RoomSymbolNode[] = fns.map(fn => {
    const b = buckets[fn.name];
    const inboundCount = b.inbound.length;
    const outboundCount = b.outbound.length + b.internal.length;
    return {
      name: fn.name,
      startLine: fn.startLine,
      endLine: fn.endLine,
      complexity: fn.complexity,
      inbound: b.inbound,
      outbound: b.outbound,
      internal: b.internal,
      effects: b.effects,
      looksLikeEntry: inboundCount >= 2 && outboundCount <= inboundCount,
      looksLikeLeaf: outboundCount === 0 && inboundCount > 0,
    };
  });

  return { fileId, symbols, topLevelEdgeCount };
}

interface CallBucket {
  inbound: RoomCall[];
  outbound: RoomCall[];
  internal: RoomCall[];
  effects: RoomCall[];
}

function resolveByLine(
  fns: readonly FunctionBlock[],
  line: number | undefined,
  buckets: Record<string, CallBucket>,
): CallBucket | null {
  if (line === undefined) return null;
  // Tiny list (typical file has <30 fns); linear scan is fine.
  for (const fn of fns) {
    if (inside(fn, line)) return buckets[fn.name];
  }
  return null;
}
