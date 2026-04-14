import { MatchDecorator, Decoration, ViewPlugin, EditorView } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import type { SymbolFacts } from "@/entities/symbol";

export interface HoverAnchor {
  info: SymbolFacts;
  rect: { left: number; top: number; bottom: number; right: number };
}

export function symbolHover(
  symbols: SymbolFacts[],
  onHover: (a: HoverAnchor | null) => void,
) {
  const byName: Record<string, SymbolFacts> = {};
  for (const s of symbols) byName[s.name] = s;

  const names = Object.keys(byName)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`\\b(?:${names.join("|")})\\b`, "g");

  const decorator = new MatchDecorator({
    regexp: pattern,
    decoration: (m) =>
      Decoration.mark({
        class: "cm-sym",
        attributes: { "data-sym": m[0] },
      }),
  });

  const plugin = ViewPlugin.fromClass(
    class {
      marks: DecorationSet;
      constructor(view: EditorView) {
        this.marks = decorator.createDeco(view);
      }
      update(u: ViewUpdate) {
        this.marks = decorator.updateDeco(u, this.marks);
      }
    },
    { decorations: (v) => v.marks },
  );

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
      const el = t?.closest(".cm-sym") as HTMLElement | null;
      if (!el || el === currentEl) return;
      currentEl = el;
      const name = el.getAttribute("data-sym");
      if (!name) return;
      const info = byName[name];
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
      const el = t?.closest(".cm-sym") as HTMLElement | null;
      if (!el) return;
      const related = e.relatedTarget as Node | null;
      if (related && el.contains(related)) return;
      currentEl = null;
      clearPending();
      pending = window.setTimeout(() => {
        onHover(null);
        pending = null;
      }, 120);
    },
  });

  return [plugin, events];
}
