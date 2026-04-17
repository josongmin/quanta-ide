import type { CodeFragment, LineMarker } from "@quanta/app-ide/entities/canvas";

/**
 * Parse Python source into a FigJam-style hierarchical node tree.
 *
 * Result: flat list at the top level, but class fragments contain
 * children (methods). The view renders these as nested sub-window cards.
 *
 *  - "imports"      → preamble block (imports, constants, header)
 *  - "class"        → class node with children (methods)
 *  - "function"     → standalone top-level function
 *  - "module-level" → misc module-level code
 */
export function buildFragments(
  source: string,
  markers: LineMarker[],
): CodeFragment[] {
  const lines = source.split("\n");
  const totalLines = lines.length;
  if (totalLines === 0) return [];

  // Signal lines for flagging
  const signalLines = new Set<number>();
  for (const m of markers) {
    if (m.kind !== "fn-entry") signalLines.add(m.line);
  }

  // ── Find all declarations with indent level ───────────────────
  interface Decl {
    line: number;   // 1-based
    label: string;
    kind: "class" | "function";
    indent: number;
  }

  const decls: Decl[] = [];
  for (let i = 0; i < totalLines; i++) {
    const text = lines[i];
    const trimmed = text.trimStart();
    const indent = text.length - trimmed.length;

    if (trimmed.startsWith("class ")) {
      const name = trimmed.slice(6).split(/[:(]/)[0].trim();
      decls.push({ line: i + 1, label: name, kind: "class", indent });
    } else if (trimmed.startsWith("def ")) {
      const name = trimmed.slice(4).split("(")[0].trim();
      decls.push({ line: i + 1, label: name, kind: "function", indent });
    }
  }

  if (decls.length === 0) {
    return [makeFragment("node-0", "source", "module-level", 1, totalLines, signalLines)];
  }

  // ── Separate top-level vs nested ──────────────────────────────
  const topDecls: Decl[] = [];
  const childMap = new Map<number, Decl[]>();
  let curClassIdx = -1;

  for (const d of decls) {
    if (d.indent === 0) {
      topDecls.push(d);
      curClassIdx = d.kind === "class" ? topDecls.length - 1 : -1;
    } else if (curClassIdx >= 0) {
      const kids = childMap.get(curClassIdx) ?? [];
      kids.push(d);
      childMap.set(curClassIdx, kids);
    }
  }

  // ── Build fragments ───────────────────────────────────────────
  const fragments: CodeFragment[] = [];
  let counter = 0;

  // Preamble
  if (topDecls[0].line > 1) {
    fragments.push(makeFragment(
      `node-${counter++}`, "preamble", "imports",
      1, topDecls[0].line - 1, signalLines,
    ));
  }

  for (let i = 0; i < topDecls.length; i++) {
    const decl = topDecls[i];
    const nextStart = i + 1 < topDecls.length ? topDecls[i + 1].line : totalLines + 1;

    // Include decorators
    let start = decl.line;
    while (start > 1) {
      const prev = lines[start - 2].trimStart();
      if (prev.startsWith("@") || prev === "") start--;
      else break;
    }
    if (fragments.length > 0) {
      const prevEnd = fragments[fragments.length - 1].endLine;
      if (start <= prevEnd) start = prevEnd + 1;
    }

    const end = i + 1 < topDecls.length ? nextStart - 1 : totalLines;
    const id = `node-${counter++}`;
    const frag = makeFragment(id, decl.label, decl.kind, start, end, signalLines, 0);

    // Build children for class
    const kids = childMap.get(i);
    if (kids && kids.length > 0) {
      frag.children = [];
      for (let ci = 0; ci < kids.length; ci++) {
        const child = kids[ci];
        const childNext = ci + 1 < kids.length ? kids[ci + 1].line : end + 1;

        let cStart = child.line;
        while (cStart > start) {
          const prev = lines[cStart - 2].trimStart();
          if (prev.startsWith("@") || prev === "") cStart--;
          else break;
        }
        if (frag.children.length > 0) {
          const prevEnd = frag.children[frag.children.length - 1].endLine;
          if (cStart <= prevEnd) cStart = prevEnd + 1;
        } else if (cStart <= start) {
          cStart = start + 1;
        }

        const cEnd = Math.min(childNext - 1, end);
        frag.children.push(makeFragment(
          `${id}-m${ci}`, child.label, "function", cStart, cEnd, signalLines, 1,
        ));
      }
    }

    fragments.push(frag);
  }

  return fragments;
}

function makeFragment(
  id: string,
  label: string,
  kind: CodeFragment["kind"],
  startLine: number,
  endLine: number,
  signalLines: Set<number>,
  depth: number = 0,
): CodeFragment {
  let signalCount = 0;
  for (let line = startLine; line <= endLine; line++) {
    if (signalLines.has(line)) signalCount++;
  }
  return {
    id, label, kind, startLine, endLine, signalCount, depth,
    defaultExpanded: true,
  };
}

// ── Visible ranges (API compat) ──────────────────────────────────

export interface VisibleRange {
  kind: "lines" | "fold";
  startLine: number;
  endLine: number;
  foldedCount?: number;
}

export function computeVisibleRanges(
  fragment: CodeFragment,
  _signalLines: Set<number>,
): VisibleRange[] {
  return [{ kind: "lines", startLine: fragment.startLine, endLine: fragment.endLine }];
}
