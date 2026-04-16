import { useMemo } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import type {
  CanvasEdge,
  CanvasGraph,
  ClassGroup,
  CanvasNode,
  ExternalNode,
  NodeEnrichment,
  TaintChain,
  TaintChainNode,
} from "@quanta/app-ide/entities/canvas";
import type { FunctionHeader } from "@quanta/app-ide/entities/function";
import type { Layer, SymbolFacts } from "@quanta/app-ide/entities/symbol";
import type { BehaviorDiffChunk } from "@quanta/app-ide/entities/behavior";
import { layoutGraph } from "./layout";

/**
 * Determine which function "owns" a given line number.
 * Functions are sorted by line; a call-site belongs to the function
 * whose line is the largest that does not exceed the call-site line.
 */
function findOwnerFn(
  line: number,
  sortedFns: FunctionHeader[],
): FunctionHeader | undefined {
  let owner: FunctionHeader | undefined;
  for (const fn of sortedFns) {
    if (fn.line <= line) owner = fn;
    else break;
  }
  return owner;
}

/**
 * Derive a plausible file path from a symbol name + layer.
 * "HTTPController.handle" + "adapter" -> "adapter/http_controller.py"
 */
function derivePath(name: string, layer?: Layer): string {
  const className = name.split(".")[0];
  const snake = className
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
  return layer ? `${layer}/${snake}.py` : `${snake}.py`;
}

/**
 * Check if any behaviorDiff chunk with semantic/runtime kind falls within a
 * function's line range.
 */
function hasBehaviorChangeAt(
  fnLine: number,
  nextFnLine: number | undefined,
  diffs: BehaviorDiffChunk[],
): boolean {
  return diffs.some(
    (d) =>
      (d.kind === "semantic" || d.kind === "runtime") &&
      d.line >= fnLine &&
      (nextFnLine === undefined || d.line < nextFnLine),
  );
}

/**
 * Build NodeEnrichment from a SymbolFacts entry and behaviorDiff data.
 */
function buildEnrichment(
  sym: SymbolFacts,
  fnLine: number,
  nextFnLine: number | undefined,
  behaviorDiff: BehaviorDiffChunk[],
): NodeEnrichment | undefined {
  const e: NodeEnrichment = {};
  if (sym.heat) e.heat = sym.heat;
  if (sym.stability !== undefined) e.stability = sym.stability;
  if (sym.churn90d !== undefined) e.churn90d = sym.churn90d;
  if (sym.incidentMatch) e.incidentMatch = sym.incidentMatch;
  if (sym.hotPath) e.hotPath = sym.hotPath;
  if (sym.callers !== undefined) e.callers = sym.callers;
  if (sym.callees !== undefined) e.callees = sym.callees;
  if (hasBehaviorChangeAt(fnLine, nextFnLine, behaviorDiff)) {
    e.hasBehaviorChange = true;
  }
  return Object.keys(e).length > 0 ? e : undefined;
}

/**
 * Transform a FileFacts into a fully laid-out CanvasGraph.
 *
 * Extracts three kinds of edges:
 *  - "call"  -- from callSites (internal <-> internal, or internal -> external)
 *  - "taint" -- from callSites with taintPath, or from top-level taintPaths
 *  - "dep"   -- from symbol dependency info (deduped against call edges)
 *
 * Builds ClassGroup containers for class symbols with their methods nested
 * inside, and standalone CanvasNode entries for non-method functions.
 *
 * External nodes are partitioned into left (incoming callers) and right
 * (outgoing callees) columns, then positioned by layoutGraph.
 */
export function useCanvasGraph(file: FileFacts): CanvasGraph {
  return useMemo(() => {
    // ── Symbol lookup ─────────────────────────────────────────────────
    const symByName = new Map<string, SymbolFacts>(
      file.symbols
        .filter((s) => s.kind === "class" || s.kind === "method" || s.kind === "function")
        .map((s) => [s.name, s]),
    );

    // ── Separate function headers by kind ─────────────────────────────
    const classes = file.functionHeaders.filter((f) => f.kind === "class");
    const methods = file.functionHeaders.filter((f) => f.kind === "method");
    const standaloneFns = file.functionHeaders.filter((f) => f.kind === "function");

    // All function headers sorted by line for ownership lookups
    const allHeaders = [...file.functionHeaders].sort((a, b) => a.line - b.line);
    const fnNames = new Set(file.functionHeaders.map((f) => f.name));

    // Sorted line boundaries for enrichment (next fn line)
    const sortedLines = allHeaders.map((f) => f.line);

    function nextFnLineAfter(line: number): number | undefined {
      for (const l of sortedLines) {
        if (l > line) return l;
      }
      return undefined;
    }

    // ── Assign methods to classes ─────────────────────────────────────
    const sortedClasses = [...classes].sort((a, b) => a.line - b.line);

    const classGroups: ClassGroup[] = sortedClasses.map((cls) => {
      const classSym = symByName.get(cls.name);
      const classMethods = methods.filter((m) => {
        // A method belongs to the class whose line is the largest <= method.line
        let owner: FunctionHeader | undefined;
        for (const c of sortedClasses) {
          if (c.line <= m.line) owner = c;
          else break;
        }
        return owner?.name === cls.name;
      });

      return {
        id: cls.name,
        fn: cls,
        enrichment: classSym
          ? buildEnrichment(classSym, cls.line, nextFnLineAfter(cls.line), file.behaviorDiff)
          : undefined,
        methods: classMethods.map((m) => {
          const mSym = symByName.get(m.name);
          return {
            id: m.name,
            fn: m,
            enrichment: mSym
              ? buildEnrichment(mSym, m.line, nextFnLineAfter(m.line), file.behaviorDiff)
              : undefined,
            x: 0,
            y: 0,
            w: 0,
            h: 0,
          };
        }),
        x: 0,
        y: 0,
        w: 0,
        h: 0,
      };
    });

    // ── Build standalone nodes with enrichment ────────────────────────
    const standaloneNodes: CanvasNode[] = standaloneFns.map((f) => {
      const sym = symByName.get(f.name);
      return {
        id: f.name,
        fn: f,
        enrichment: sym
          ? buildEnrichment(sym, f.line, nextFnLineAfter(f.line), file.behaviorDiff)
          : undefined,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
      };
    });

    // ── Edge and external node construction ───────────────────────────
    const edgeSet = new Set<string>(); // "from|to|kind" for dedup
    const edges: CanvasEdge[] = [];
    const extMap = new Map<string, ExternalNode>(); // keyed by "side:name"

    function addEdge(
      from: string,
      to: string,
      kind: CanvasEdge["kind"],
      severity?: 1 | 2 | 3,
      label?: string,
      taintSteps?: { symbol: string; hop: string }[],
    ): void {
      if (from === to) return; // no self-loops
      const key = `${from}|${to}|${kind}`;
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      edges.push({ id: `${kind}-${from}-${to}`, from, to, kind, severity, label, taintSteps });
    }

    function ensureExternal(
      name: string,
      side: "left" | "right",
      extFile?: string,
      layer?: Layer,
      connectedInternal?: string,
    ): string {
      const key = `${side}:${name}`;
      const id = `ext:${side}:${name}`;
      if (!extMap.has(key)) {
        extMap.set(key, {
          id,
          name,
          file: extFile ?? (layer ? derivePath(name, layer) : undefined),
          layer,
          side,
          connectedTo: connectedInternal ? [connectedInternal] : [],
          x: 0,
          y: 0,
          w: 0,
          h: 0,
        });
      } else if (connectedInternal) {
        const existing = extMap.get(key)!;
        if (!existing.connectedTo.includes(connectedInternal)) {
          existing.connectedTo.push(connectedInternal);
        }
      }
      return id;
    }

    // ── 1. Internal edges + external callees from callSites ───────────
    for (const cs of file.callSites) {
      const owner = findOwnerFn(cs.line, allHeaders);
      if (!owner) continue;

      if (fnNames.has(cs.callee)) {
        // Internal call
        addEdge(owner.name, cs.callee, "call");
        if (cs.taintPath) {
          addEdge(
            owner.name,
            cs.callee,
            "taint",
            cs.taintPath.severity,
            undefined,
            cs.taintPath.steps.map((s) => ({ symbol: s.symbol, hop: s.hop })),
          );
        }
      } else {
        // External callee (outgoing -> right side)
        const extId = ensureExternal(
          cs.callee,
          "right",
          cs.calleeFile,
          undefined,
          owner.name,
        );
        addEdge(owner.name, extId, "call");
        if (cs.taintPath) {
          addEdge(
            owner.name,
            extId,
            "taint",
            cs.taintPath.severity,
            undefined,
            cs.taintPath.steps.map((s) => ({ symbol: s.symbol, hop: s.hop })),
          );
        }
      }
    }

    // ── 2. External nodes from symbol deps ────────────────────────────
    for (const sym of file.symbols) {
      if (sym.kind !== "function" && sym.kind !== "method" && sym.kind !== "class") continue;
      if (!fnNames.has(sym.name) || !sym.deps) continue;

      // Incoming callers -> left side
      for (const inc of sym.deps.incoming) {
        if (fnNames.has(inc.name)) continue; // skip internal
        const extId = ensureExternal(
          inc.name,
          "left",
          undefined,
          inc.layer,
          sym.name,
        );
        addEdge(extId, sym.name, "dep");
      }

      // Outgoing callees -> right side
      for (const out of sym.deps.outgoing) {
        if (fnNames.has(out.name)) continue; // skip internal
        const extId = ensureExternal(
          out.name,
          "right",
          undefined,
          out.layer,
          sym.name,
        );
        // Only add dep if no call edge already exists
        const callKey = `${sym.name}|${extId}|call`;
        if (!edgeSet.has(callKey)) {
          addEdge(sym.name, extId, "dep");
        }
      }
    }

    // ── 3. Taint edges from top-level taintPaths ──────────────────────
    for (const tp of file.taintPaths) {
      if (tp.steps.length < 2) continue;
      const srcFn = findOwnerFn(tp.steps[0].line, allHeaders);
      const sinkFn = findOwnerFn(
        tp.steps[tp.steps.length - 1].line,
        allHeaders,
      );
      if (
        srcFn &&
        sinkFn &&
        fnNames.has(srcFn.name) &&
        fnNames.has(sinkFn.name)
      ) {
        addEdge(
          srcFn.name,
          sinkFn.name,
          "taint",
          tp.severity,
          undefined,
          tp.steps.map((s) => ({ symbol: s.symbol, hop: s.hop })),
        );
      }
    }

    // ── 4. Back-fill callSite file info for dep-created externals ─────
    for (const ext of extMap.values()) {
      if (!ext.file) {
        const matchingCallSite = file.callSites.find(
          (cs) => cs.callee === ext.name,
        );
        if (matchingCallSite) ext.file = matchingCallSite.calleeFile;
      }
    }

    // ── Build taint chains ──────────────────────────────────────────
    const taintChains: TaintChain[] = [];

    for (const tp of file.taintPaths) {
      if (tp.steps.length < 2) continue;

      const firstStep = tp.steps[0];
      const lastStep = tp.steps[tp.steps.length - 1];
      const middleSteps = tp.steps.slice(1, -1);

      const chainNodes: TaintChainNode[] = [];

      // Source endpoint
      const srcOwner = findOwnerFn(firstStep.line, allHeaders);
      chainNodes.push({
        id: `${tp.id}:source`,
        kind: "source",
        symbol: firstStep.symbol,
        detail: firstStep.detail,
        ownerFn: srcOwner?.name,
        x: 0, y: 0, w: 0, h: 0,
      });

      // Bundle middle steps (if any)
      if (middleSteps.length > 0) {
        const bundledSymbols = middleSteps.map((s) => s.symbol);
        const firstMiddle = middleSteps[0];
        const matchingCS = file.callSites.find(
          (cs) =>
            cs.callee === firstMiddle.symbol ||
            firstMiddle.symbol.includes(cs.callee.split(".").pop() ?? ""),
        );

        chainNodes.push({
          id: `${tp.id}:bundle`,
          kind: "bundle",
          symbol: middleSteps.map((s) => s.symbol).join(" \u2192 "),
          detail: `${middleSteps.length} hops`,
          file: matchingCS?.calleeFile,
          ownerFn: findOwnerFn(firstMiddle.line, allHeaders)?.name,
          bundledSymbols,
          x: 0, y: 0, w: 0, h: 0,
        });
      }

      // Sink endpoint
      const sinkOwner = findOwnerFn(lastStep.line, allHeaders);
      const sinkCS = file.callSites.find(
        (cs) =>
          lastStep.symbol.includes(cs.callee.split(".").pop() ?? "") ||
          cs.callee === lastStep.symbol,
      );
      chainNodes.push({
        id: `${tp.id}:sink`,
        kind: "sink",
        symbol: lastStep.symbol,
        detail: lastStep.detail,
        file: sinkCS?.calleeFile,
        ownerFn: sinkOwner?.name,
        x: 0, y: 0, w: 0, h: 0,
      });

      taintChains.push({
        id: tp.id,
        severity: tp.severity,
        owasp: tp.owasp,
        nodes: chainNodes,
        y: 0,
      });

      // ── Connect chain endpoints to external nodes ──────────────────
      // Source: connect incoming external callers → chain source node
      if (srcOwner) {
        for (const ext of extMap.values()) {
          if (ext.side === "left" && ext.connectedTo.includes(srcOwner.name)) {
            addEdge(ext.id, `${tp.id}:source`, "taint", tp.severity);
          }
        }
      }

      // Sink: connect chain sink node → outgoing external callee
      if (sinkCS) {
        const sinkExtId = `ext:right:${sinkCS.callee}`;
        if (extMap.has(`right:${sinkCS.callee}`)) {
          addEdge(`${tp.id}:sink`, sinkExtId, "taint", tp.severity);
        }
      }

      // Bundle: connect bundle to external callees for propagation hops
      for (const ms of middleSteps) {
        const mCS = file.callSites.find(
          (cs) => ms.symbol.includes(cs.callee.split(".").pop() ?? "") || cs.callee === ms.symbol,
        );
        if (mCS && extMap.has(`right:${mCS.callee}`)) {
          addEdge(`${tp.id}:bundle`, `ext:right:${mCS.callee}`, "taint", tp.severity);
        }
      }
    }

    return layoutGraph(
      {
        name: file.name,
        riskScore: file.riskScore,
        loc: file.loc,
        owner: file.owner,
      },
      classGroups,
      standaloneNodes,
      [...extMap.values()],
      edges,
      taintChains,
    );
  }, [file]);
}
