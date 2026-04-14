import { EditorView, ViewPlugin, Decoration } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import type { CallSiteFacts } from "@/entities/call-site";

export interface CallSiteAnchor {
  info: CallSiteFacts;
  rect: { left: number; top: number; bottom: number; right: number };
}

export function callSiteHover(
  sites: CallSiteFacts[],
  onHover: (a: CallSiteAnchor | null) => void,
) {
  const byLine = new Map<number, CallSiteFacts>();
  for (const s of sites) byLine.set(s.line, s);

  const deco = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(u: ViewUpdate) {
        if (u.viewportChanged || u.docChanged) this.decorations = build(u.view);
      }
    },
    { decorations: (v) => v.decorations },
  );

  function build(view: EditorView): DecorationSet {
    const b = new RangeSetBuilder<Decoration>();
    const doc = view.state.doc;
    const lines = [...byLine.keys()].sort((a, b) => a - b);
    for (const line of lines) {
      if (line < 1 || line > doc.lines) continue;
      const info = byLine.get(line)!;
      const lineObj = doc.line(line);
      const range = findCalleeRange(lineObj.text, info.callee);
      if (!range) continue;
      b.add(
        lineObj.from + range[0],
        lineObj.from + range[1],
        Decoration.mark({ class: "cm-callsite", attributes: { "data-callsite": String(line) } }),
      );
    }
    return b.finish();
  }

  let pending: number | null = null;
  let currentEl: HTMLElement | null = null;
  const clearPending = () => {
    if (pending !== null) {
      window.clearTimeout(pending);
      pending = null;
    }
  };

  const events = EditorView.domEventHandlers({
    mouseover: (e) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".cm-sym")) return;
      const el = t?.closest(".cm-callsite") as HTMLElement | null;
      if (!el || el === currentEl) return;
      currentEl = el;
      const lineAttr = el.getAttribute("data-callsite");
      if (!lineAttr) return;
      const info = byLine.get(Number(lineAttr));
      if (!info) return;
      clearPending();
      const rect = el.getBoundingClientRect();
      onHover({
        info,
        rect: { left: rect.left, top: rect.top, bottom: rect.bottom, right: rect.right },
      });
    },
    mouseout: (e) => {
      const t = e.target as HTMLElement | null;
      const el = t?.closest(".cm-callsite") as HTMLElement | null;
      if (!el) return;
      const related = e.relatedTarget as Node | null;
      if (related && el.contains(related)) return;
      currentEl = null;
      clearPending();
      pending = window.setTimeout(() => {
        onHover(null);
        pending = null;
      }, 140);
    },
  });

  return [deco, events];
}

function findCalleeRange(lineText: string, callee: string): [number, number] | null {
  const method = callee.split(".").pop() ?? callee;
  const methodIdx = lineText.indexOf(method);
  if (methodIdx < 0) return null;
  const before = lineText.slice(0, methodIdx);
  const receiverMatch = /([\w.]+)\.$/.exec(before);
  const start = receiverMatch ? methodIdx - receiverMatch[0].length : methodIdx;
  return [start, methodIdx + method.length];
}
