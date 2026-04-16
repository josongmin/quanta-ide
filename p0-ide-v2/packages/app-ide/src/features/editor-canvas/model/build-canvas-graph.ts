import type { FileFacts } from "@quanta/app-ide/entities/file";
import type { CanvasEdge, CanvasGraph, ExternalNode, LineMarker } from "@quanta/app-ide/entities/canvas";
import type { Layer } from "@quanta/app-ide/entities/symbol";
import { derivePath, findSymbolInLine, symbolColor, detectTerminalKind } from "../lib/graph-helpers";
import { layoutGraph } from "./layout";

/**
 * Build a positioned CanvasGraph from FileFacts and source code.
 * Pure function -- no React dependency, fully testable.
 */
export function buildCanvasGraph(file: FileFacts, source: string): CanvasGraph {
  const fnNames = new Set(file.functionHeaders.map((f) => f.name));
  const sourceLines = source.split("\n");

  const edges: CanvasEdge[] = [];
  const markers: LineMarker[] = [];
  const extMap = new Map<string, ExternalNode>();
  const edgeSet = new Set<string>();

  const colorCache = new Map<string, string>();
  function getColor(name: string): string {
    const key = name.split(".")[0];
    if (!colorCache.has(key)) colorCache.set(key, symbolColor(key));
    return colorCache.get(key)!;
  }

  function ensureExt(name: string, side: "left" | "right", extFile?: string, layer?: Layer): string {
    const key = `${side}:${name}`;
    const id = `ext:${side}:${name}`;
    if (!extMap.has(key)) {
      extMap.set(key, {
        id, name,
        file: extFile ?? (layer ? derivePath(name, layer) : undefined),
        layer, side, connectedTo: [],
        x: 0, y: 0, w: 0, h: 0,
      });
    }
    return id;
  }

  function addEdge(
    line: number, symbol: string, side: "left" | "right",
    extNodeId: string, kind: CanvasEdge["kind"],
    label: string, severity?: 1 | 2 | 3,
  ): void {
    const key = `${line}|${side}|${extNodeId}|${kind}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    const pos = findSymbolInLine(sourceLines, line, symbol);
    const color = getColor(extNodeId.replace("ext:left:", "").replace("ext:right:", ""));
    edges.push({
      id: `e-${edges.length}`,
      line,
      col: pos?.col ?? 0,
      symbolLen: pos?.len ?? 0,
      side, extNodeId, kind, severity, label, color,
    });
  }

  // ── 1. Function entry markers ────────────────────────────────────────
  for (const fn of file.functionHeaders) {
    if (fn.kind === "class" || fn.kind === "method" || fn.kind === "function") {
      markers.push({ line: fn.line, side: "left", kind: "fn-entry", label: fn.name });
    }
  }

  // ── 2. CallSites -> outgoing edges (right side) ──────────────────────
  for (const cs of file.callSites) {
    if (fnNames.has(cs.callee)) continue;
    const extId = ensureExt(cs.callee, "right", cs.calleeFile);
    const shortName = cs.callee.split(".").pop() ?? cs.callee;
    addEdge(cs.line, shortName, "right", extId, "call", `calls ${cs.callee}`);
    markers.push({ line: cs.line, side: "right", kind: "call-out", label: cs.callee, extNodeId: extId });

    if (cs.taintPath) {
      addEdge(cs.line, shortName, "right", extId, "taint",
        `taint: ${cs.taintPath.steps[0]?.hop ?? ""} → ${cs.taintPath.steps[cs.taintPath.steps.length - 1]?.hop ?? ""}`,
        cs.taintPath.severity);
    }
  }

  // ── 3. Symbol deps -> incoming / outgoing ─────────────────────────────
  for (const sym of file.symbols) {
    if (!["class", "method", "function"].includes(sym.kind)) continue;
    if (!fnNames.has(sym.name) || !sym.deps) continue;

    for (const inc of sym.deps.incoming) {
      if (fnNames.has(inc.name)) continue;
      const extId = ensureExt(inc.name, "left", undefined, inc.layer);
      addEdge(sym.line, sym.name, "left", extId, "dep", `${inc.name} calls this`);
      markers.push({ line: sym.line, side: "left", kind: "dep-in", label: inc.name, extNodeId: extId });
    }

    for (const out of sym.deps.outgoing) {
      if (fnNames.has(out.name)) continue;
      const extId = ensureExt(out.name, "right", undefined, out.layer);
      const callKey = `${sym.line}|right|${extId}|call`;
      if (!edgeSet.has(callKey)) {
        addEdge(sym.line, sym.name, "right", extId, "dep", `uses ${out.name}`);
      }
    }
  }

  // ── 4. Taint path markers ────────────────────────────────────────────
  for (const tp of file.taintPaths) {
    for (const step of tp.steps) {
      const kind = step.hop === "source" ? "taint-source" : step.hop === "sink" ? "taint-sink" : "taint-through";
      markers.push({ line: step.line, side: "left", kind, label: step.symbol, severity: tp.severity });
    }
  }

  // ── 5. Back-fill file on dep externals ───────────────────────────────
  for (const ext of extMap.values()) {
    if (!ext.file) {
      const cs = file.callSites.find((c) => c.callee === ext.name);
      if (cs) ext.file = cs.calleeFile;
    }
  }

  // ── 6. Terminal endpoints (DB, cache, etc.) ──────────────────────────
  const symByName = new Map(file.symbols.map((s) => [s.name, s]));
  const plusOneClassNames = new Map<string, { extId: string; line: number }>();
  for (const cs of file.callSites) {
    if (fnNames.has(cs.callee)) continue;
    const className = cs.callee.split(".")[0];
    const ext = extMap.get(`right:${cs.callee}`);
    if (ext) plusOneClassNames.set(className, { extId: ext.id, line: cs.line });
  }
  for (const [className, info] of plusOneClassNames) {
    const sym = symByName.get(className);
    if (!sym?.deps?.outgoing) continue;
    for (const out of sym.deps.outgoing) {
      const termKind = detectTerminalKind(out.name);
      if (!termKind) continue;
      const termKey = `right:${out.name}`;
      if (!extMap.has(termKey)) {
        extMap.set(termKey, {
          id: `ext:right:${out.name}`, name: out.name,
          file: undefined, layer: out.layer, side: "right", connectedTo: [],
          isTerminal: true, terminalKind: termKind,
          x: 0, y: 0, w: 0, h: 0,
        });
      }
      addEdge(info.line, out.name, "right", `ext:right:${out.name}`, "dep",
        `via ${className} → ${out.name}`);
    }
  }

  return layoutGraph(
    {
      name: file.name, riskScore: file.riskScore, loc: file.loc, owner: file.owner,
      cpxMax: file.cpxMax, cpxBudgetPct: file.cpxBudgetPct,
      blast: file.blast, blastCritical: file.blastCritical,
      taintCount: file.taintCount, archViolations: file.archViolations, deadCount: file.deadCount,
    },
    source, markers, [...extMap.values()], edges,
  );
}
