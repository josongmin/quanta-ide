import type { CodeRange } from "./types";

function closestLineEl(node: Node | null, root: HTMLElement): HTMLElement | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n instanceof HTMLElement && n.dataset.editorLine) return n;
    n = n.parentNode;
  }
  return null;
}

function codeEl(lineEl: HTMLElement): HTMLElement | null {
  return lineEl.querySelector(".ide-editor-code");
}

/** Offset within line’s code block for a boundary (container, offset). */
function offsetInCode(codeEl: HTMLElement, container: Node, offset: number): number | null {
  if (!codeEl.contains(container) && codeEl !== container) return null;
  const range = document.createRange();
  try {
    range.setStart(codeEl, 0);
    range.setEnd(container, offset);
  } catch {
    return null;
  }
  return range.toString().length;
}

/**
 * Maps the current document selection to a {@link CodeRange} when it lies inside
 * `.ide-editor-code` regions under `root` (e.g. `.ide-editor-body`).
 */
export function selectionToCodeRange(root: HTMLElement, sel: Selection): CodeRange | null {
  if (sel.rangeCount === 0 || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.commonAncestorContainer)) return null;

  const startLineEl = closestLineEl(r.startContainer, root);
  const endLineEl = closestLineEl(r.endContainer, root);
  if (!startLineEl || !endLineEl) return null;

  const startLine = Number(startLineEl.dataset.editorLine);
  const endLine = Number(endLineEl.dataset.editorLine);
  if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) return null;

  const startCode = codeEl(startLineEl);
  const endCode = codeEl(endLineEl);
  if (!startCode || !endCode) return null;

  const startCol = offsetInCode(startCode, r.startContainer, r.startOffset);
  const endCol = offsetInCode(endCode, r.endContainer, r.endOffset);
  if (startCol === null || endCol === null) return null;

  return { startLine, startCol, endLine, endCol };
}

export function fullLineRangeFromDom(root: HTMLElement, lineNo: number): CodeRange | null {
  const lineEl = root.querySelector<HTMLElement>(`[data-editor-line="${lineNo}"]`);
  const code = lineEl && codeEl(lineEl);
  if (!code) return null;
  const len = code.textContent.length;
  return { startLine: lineNo, startCol: 0, endLine: lineNo, endCol: len };
}

export function formatRangeLabel(r: CodeRange): string {
  const sameLine = r.startLine === r.endLine;
  if (sameLine && r.startCol === 0 && r.endCol === 0) return `L${r.startLine}`;
  if (sameLine) return `L${r.startLine}:${r.startCol}–${r.endCol}`;
  return `L${r.startLine}:${r.startCol} → L${r.endLine}:${r.endCol}`;
}
