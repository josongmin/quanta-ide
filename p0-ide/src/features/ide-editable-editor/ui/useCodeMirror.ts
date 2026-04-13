import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { syntaxHighlighting } from "@codemirror/language";
// eslint-disable-next-line no-restricted-imports -- composition: editor consumes hover logic
import { useEditorHover } from "@/features/ide-editor-hover";
import type { LineMeta } from "@/app/ide/mock-source";
import { ideHighlight, ideTheme } from "./codemirror-theme";
import { lineMetaField, setLineMeta, riskGutter, coverageGutter, churnGutter } from "./codemirror-gutters";
import { deadLinesPlugin, inlineHintsPlugin } from "./codemirror-decorations";
import { createHoverExtension } from "./codemirror-hover";

export function useCodeMirror(
  containerRef: React.RefObject<HTMLDivElement | null>,
  source: string,
  lineMeta: Record<number, LineMeta>,
  onChange?: (code: string, changedLine: number) => void,
) {
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const setSymbol = useEditorHover((s) => s.setSymbol);
  const scheduleDismiss = useEditorHover((s) => s.scheduleDismiss);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const newCode = update.state.doc.toString();
      let changedLine = 1;
      for (const tr of update.transactions) {
        tr.changes.iterChanges((_fromA, _toA, _fromB) => {
          changedLine = update.state.doc.lineAt(_fromB).number;
        });
      }
      if (onChangeRef.current) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          onChangeRef.current?.(newCode, changedLine);
        }, 400);
      }
    });

    const state = EditorState.create({
      doc: source,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        python(),
        syntaxHighlighting(ideHighlight),
        ideTheme,
        lineMetaField.init(() => lineMeta),
        riskGutter,
        coverageGutter,
        churnGutter,
        deadLinesPlugin,
        inlineHintsPlugin,
        createHoverExtension(setSymbol, scheduleDismiss),
        updateListener,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSymbol(null);
      view.destroy();
      viewRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // update lineMeta when it changes without remounting
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({ effects: setLineMeta.of(lineMeta) });
    }
  }, [lineMeta]);
}
