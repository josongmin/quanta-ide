import { EditorView } from "@codemirror/view";
// eslint-disable-next-line no-restricted-imports -- composition: editor uses hover types
import type { SymbolInfo, SymbolHover } from "@/features/ide-editor-hover";
import { SYMBOL_INFO } from "@/app/ide/mock-source";

/* ═══════════════════════════════════════════════════════════════════════
   Symbol hover extension — looks up SYMBOL_INFO and calls setSymbol
   ═══════════════════════════════════════════════════════════════════════ */

/** Extract the identifier at a given document position, looking at the whole line. */
export function identifierAtPos(view: EditorView, pos: number): { from: number; to: number; text: string } | null {
  const line = view.state.doc.lineAt(pos);
  const lineText = line.text;
  const col = pos - line.from;
  // Match all Python identifiers on the line and find the one containing col
  const re = /[A-Za-z_][A-Za-z0-9_]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lineText)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (col >= start && col < end) {
      return { from: line.from + start, to: line.from + end, text: m[0] };
    }
  }
  return null;
}

export function createHoverExtension(
  setSymbol: (s: SymbolHover | null) => void,
  scheduleDismiss: () => void,
) {
  let lastWord = "";

  function dismiss() {
    if (lastWord) { lastWord = ""; scheduleDismiss(); }
  }

  return EditorView.domEventHandlers({
    mousemove(event, view) {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) { dismiss(); return; }

      // Verify cursor is over actual text, not trailing whitespace
      const charCoords = view.coordsAtPos(pos);
      if (charCoords && event.clientX > charCoords.right + 2) { dismiss(); return; }

      const ident = identifierAtPos(view, pos);
      if (!ident) { dismiss(); return; }
      if (ident.text === lastWord) return;

      const info = SYMBOL_INFO[ident.text] as SymbolInfo | undefined;
      if (info) {
        lastWord = ident.text;
        const coords = view.coordsAtPos(ident.from);
        if (coords) {
          setSymbol({ info, anchor: { left: coords.left, top: coords.top, bottom: coords.bottom } });
        }
      } else {
        dismiss();
      }
    },
    mouseleave() { dismiss(); },
  });
}
