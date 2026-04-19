import { useCallback, useEffect, useMemo, useRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EditorView, keymap, type KeyBinding } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import {
  inlineEditorStore,
  useInlineEditorStore,
  resolveDocForFile,
} from "../../store/inline-editor-store";
import { getAiService } from "../../lib/ai-service-ref";
import { AiEditPrompt } from "./AiEditPrompt";
import { languageExtensionsFor } from "./cm-stream-lang";
import { editRippleStore } from "../../store/edit-ripple-store";
import { sceneStore } from "../../store/scene-store";
import "./inline-editor.css";

// InlineCodeEditor
// -------------------------------------------------------------------
// CodeMirror 6 instance that swaps in for a GroundCard's read-only
// source render when that card enters inline-edit mode. Lives inside
// the scaled DOM layer — CM measures relative to its parent so cursor
// position tracks canvas zoom for free. Prompt/popup children that
// need screen-fixed sizing should portal out (see AiEditPrompt).
//
// Keymap (precedence-high so we beat CM defaults):
//   Cmd+K / Ctrl+K  → open the AI inline-edit prompt anchored at caret
//   Escape          → exit edit mode (parent resolves cascade)
//   Cmd+Enter       → commit (exit + keep draft)
//   Cmd+S           → commit (same)
//
// Commit wiring is intentionally minimal here — this MVP holds edits in
// memory via `inlineEditorStore`. A future persistence layer can subscribe
// to the store and flush dirty drafts; the component contract doesn't
// change.

interface Props {
  fileId: string;
  initialSource: string;
  filename: string;
  /** Called when the user asks to exit (Esc, Cmd+Enter, Cmd+S). */
  onExit: () => void;
}

const inlineTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "12px",
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    backgroundColor: "transparent",
    color: "var(--fg)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    lineHeight: "1.45",
    overflow: "auto",
  },
  ".cm-content": { padding: "6px 0", caretColor: "var(--accent)" },
  ".cm-line": { padding: "0 12px" },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--accent) 6%, transparent)",
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--accent) 28%, transparent)",
  },
  ".cm-cursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
});

const INDENT_UNIT = "  "; // two spaces — matches indentUnit provided by the lang bundle

function extForFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

// Tab / Shift-Tab — single-caret inserts or strips one indent; multi-line
// selection indents/dedents every touched line and preserves the anchor
// + head so the same selection stays active after the edit. Written
// without @codemirror/commands so we don't pull a new dep for this.
const tabKeyBindings: readonly KeyBinding[] = [
  {
    key: "Tab",
    run: (view) => {
      const sel = view.state.selection.main;
      const doc = view.state.doc;
      if (sel.empty) {
        view.dispatch(view.state.replaceSelection(INDENT_UNIT));
        return true;
      }
      const startLine = doc.lineAt(sel.from).number;
      const endLine = doc.lineAt(sel.to).number;
      const changes = [];
      for (let n = startLine; n <= endLine; n++) {
        const line = doc.line(n);
        changes.push({ from: line.from, insert: INDENT_UNIT });
      }
      view.dispatch({ changes });
      return true;
    },
  },
  {
    key: "Shift-Tab",
    run: (view) => {
      const sel = view.state.selection.main;
      const doc = view.state.doc;
      const startLine = doc.lineAt(sel.from).number;
      const endLine = doc.lineAt(sel.to).number;
      const changes = [];
      for (let n = startLine; n <= endLine; n++) {
        const line = doc.line(n);
        const text = line.text;
        const trimCount = text.startsWith(INDENT_UNIT)
          ? INDENT_UNIT.length
          : text.startsWith("\t") ? 1 : 0;
        if (trimCount > 0) {
          changes.push({ from: line.from, to: line.from + trimCount });
        }
      }
      if (changes.length === 0) return true;
      view.dispatch({ changes });
      return true;
    },
  },
];

export function InlineCodeEditor({
  fileId,
  initialSource,
  filename,
  onExit,
}: Props) {
  const cmRef = useRef<ReactCodeMirrorRef | null>(null);

  // Read the current draft once for the initial render so CM's internal
  // state is seeded correctly; subsequent edits round-trip through the
  // store via `onChange`. We don't drive CM's `value` prop reactively
  // after mount — that would cause feedback loops with the store.
  const initialDoc = useMemo(
    () => resolveDocForFile(fileId, initialSource),
    [fileId, initialSource],
  );

  const handleChange = useCallback((next: string) => {
    inlineEditorStore.setDraft(fileId, next);
  }, [fileId]);

  const captureSelectionAndOpen = useCallback((): boolean => {
    const view = cmRef.current?.view;
    if (!view) return false;
    const range = view.state.selection.main;
    const from = range.from;
    const to = range.to;
    const coords = view.coordsAtPos(from);
    if (!coords) return false;
    inlineEditorStore.openAiPrompt(fileId, {
      screenX: coords.left,
      screenY: coords.top,
      selFrom: from,
      selTo: to,
    });
    return true;
  }, [fileId]);

  // Drive the AI stream when the user submits a prompt. Aborts if the
  // popup closes mid-stream (fileId mismatch / status reset).
  const runStream = useCallback(async (promptText: string) => {
    const view = cmRef.current?.view;
    if (!view) return;
    const ai = inlineEditorStore.getState().ai;
    if (ai.fileId !== fileId || !ai.anchor) return;
    inlineEditorStore.aiStreamStart();
    try {
      const svc = getAiService();
      const stream = svc.streamEdit({
        fileId,
        doc: view.state.doc.toString(),
        selFrom: ai.anchor.selFrom,
        selTo: ai.anchor.selTo,
        prompt: promptText,
        language: extForFilename(filename) || undefined,
      });
      for await (const chunk of stream) {
        const live = inlineEditorStore.getState().ai;
        if (live.fileId !== fileId || live.status !== "streaming") return;
        inlineEditorStore.aiStreamAppend(chunk.delta);
      }
      inlineEditorStore.aiStreamReady();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "stream failed";
      inlineEditorStore.aiStreamError(msg);
    }
  }, [fileId, filename]);

  const applySuggestion = useCallback((replacement: string) => {
    const view = cmRef.current?.view;
    const ai = inlineEditorStore.getState().ai;
    if (!view || !ai.anchor) return;
    view.dispatch({
      changes: { from: ai.anchor.selFrom, to: ai.anchor.selTo, insert: replacement },
      selection: { anchor: ai.anchor.selFrom + replacement.length },
      scrollIntoView: true,
    });
    inlineEditorStore.closeAiPrompt();
    view.focus();

    // Multi-file ripple — the coded-universe differentiator. An AI edit
    // on this file is assumed to semantically touch its direct graph
    // neighbours; pulse them so the user sees the edit propagate across
    // the canvas. Cap at 8 to avoid a wall of blinking cards on hubs.
    const graph = sceneStore.getState().graph;
    if (graph) {
      const neighbours = new Set<string>();
      for (const e of graph.fileEdges) {
        if (e.from === fileId) neighbours.add(e.to);
        else if (e.to === fileId) neighbours.add(e.from);
        if (neighbours.size >= 8) break;
      }
      if (neighbours.size > 0) {
        editRippleStore.fire(fileId, neighbours);
      }
    }
  }, [fileId]);

  const extensions = useMemo(() => {
    return [
      EditorView.lineWrapping,
      Prec.high(keymap.of([
        {
          key: "Mod-k",
          run: () => captureSelectionAndOpen(),
        },
        {
          key: "Mod-Enter",
          // WHY: Cmd/Ctrl+Enter saves the draft and exits. `commitDraft`
          // clears dirty + fires `lastCommit` so CommitFlash can animate.
          run: () => { inlineEditorStore.commitDraft(fileId); onExit(); return true; },
        },
        {
          key: "Mod-s",
          preventDefault: true,
          // WHY: mirrors Cmd+Enter (traditional save shortcut).
          run: () => { inlineEditorStore.commitDraft(fileId); onExit(); return true; },
        },
        {
          key: "Escape",
          run: () => { onExit(); return true; },
        },
        ...tabKeyBindings,
      ])),
      ...languageExtensionsFor(filename),
    ];
  }, [captureSelectionAndOpen, onExit, filename, fileId]);

  // Auto-focus on mount so the user can start typing without an extra click.
  useEffect(() => {
    const view = cmRef.current?.view;
    if (!view) return;
    view.focus();
  }, []);

  // Re-focus when the AI popup closes — the popup steals focus when open,
  // and users expect to keep typing without clicking back into the editor.
  const aiIsForThisFile = useInlineEditorStore(
    s => s.ai.fileId === fileId && s.ai.status !== "idle",
  );
  useEffect(() => {
    if (aiIsForThisFile) return;
    const view = cmRef.current?.view;
    view?.focus();
  }, [aiIsForThisFile]);

  const docForDiff = useInlineEditorStore(s => s.draftByFileId[fileId] ?? initialSource);

  return (
    <div
      className="inline-code-editor"
      // Stop wheel/pan events from bubbling into the canvas — otherwise
      // scrolling the editor would also pan the canvas underneath.
      onWheel={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <CodeMirror
        ref={cmRef}
        value={initialDoc}
        onChange={handleChange}
        theme={inlineTheme}
        extensions={extensions}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: false,
          autocompletion: false,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          searchKeymap: false,
        }}
        className="inline-code-editor__cm"
      />
      {aiIsForThisFile && (
        <AiEditPrompt
          doc={docForDiff}
          onSubmit={runStream}
          onAccept={applySuggestion}
          onReject={() => inlineEditorStore.closeAiPrompt()}
        />
      )}
    </div>
  );
}
