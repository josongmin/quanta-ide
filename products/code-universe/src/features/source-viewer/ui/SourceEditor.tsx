import { useMemo, type ReactElement } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import {
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { color, font } from "../../../shared/ui/tokens";
import { languageFor } from "./cm-lang";

// SourceEditor — read-only file-tier viewer.
// Monotone greyscale theme with low-saturation syntax accents so the
// chrome matches the rest of Code Universe (the header, the explorer)
// while code stays readable. The viewer is the *only* surface where
// code content ever draws color.

// Hue palette — desaturated so the page reads as "monotone with
// emphasis", not a rainbow. Tuned against a white card and text0
// as the baseline ink.
const HL_KEY = "#7a1a78";   // mauve — keywords / control flow
const HL_TYPE = "#2a5d8f";  // slate blue — typeName
const HL_FN = "#0b5c3b";    // deep moss — function calls
const HL_STR = "#a15b00";   // ochre — strings
const HL_NUM = "#8a3a00";   // sienna — numbers
const HL_CMT = "#8a8f96";   // cool grey — comments
const HL_META = "#6b4cb6";  // soft violet — attrs / decorators
const HL_PUN = "#4a4a4a";   // graphite — punctuation

const highlight = HighlightStyle.define([
  { tag: t.keyword,         color: HL_KEY,  fontWeight: "600" },
  { tag: t.controlKeyword,  color: HL_KEY,  fontWeight: "600" },
  { tag: t.definitionKeyword, color: HL_KEY, fontWeight: "600" },
  { tag: t.typeName,        color: HL_TYPE, fontWeight: "500" },
  { tag: t.className,       color: HL_TYPE, fontWeight: "500" },
  { tag: t.function(t.variableName), color: HL_FN },
  { tag: t.string,           color: HL_STR },
  { tag: t.number,           color: HL_NUM },
  { tag: t.atom,             color: HL_NUM },
  { tag: t.lineComment,      color: HL_CMT, fontStyle: "italic" },
  { tag: t.blockComment,     color: HL_CMT, fontStyle: "italic" },
  { tag: t.meta,             color: HL_META },
  { tag: t.macroName,        color: HL_META, fontWeight: "500" },
  { tag: t.punctuation,      color: HL_PUN },
  { tag: t.operator,         color: HL_PUN },
]);

const theme = EditorView.theme(
  {
    "&": {
      height: "100%",
      width: "100%",
      fontSize: `${font.size.md}px`,
      fontFamily: font.mono,
      backgroundColor: "transparent",
      color: color.text0,
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      fontFamily: font.mono,
      lineHeight: "1.55",
      overflow: "auto",
    },
    ".cm-content": {
      padding: "6px 0",
      caretColor: color.text0,
    },
    ".cm-line": {
      padding: "0 10px",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      borderRight: `1px solid ${color.borderSoft}`,
      color: color.text3,
      fontFamily: font.mono,
      fontSize: `${font.size.sm}px`,
      paddingRight: "2px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 6px 0 10px",
      minWidth: "2ch",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(10, 10, 10, 0.035)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: color.text1,
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(10, 10, 10, 0.10)",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgba(10, 10, 10, 0.14)",
    },
    ".cm-cursor": { display: "none" },
  },
  { dark: false },
);

interface Props {
  fileId: string;
  source: string;
  /** When true the viewer becomes a real editor — cursor, keymap, edits. */
  editable?: boolean;
  /** Fires on every keystroke while `editable`. In-memory only (no save). */
  onChange?: (next: string) => void;
}

export function SourceEditor({ fileId, source, editable = false, onChange }: Props): ReactElement {
  const extensions = useMemo(
    () => [
      editable ? editableTheme : theme,
      EditorView.lineWrapping,
      ...(editable ? [] : [EditorState.readOnly.of(true), EditorView.editable.of(false)]),
      indentUnit.of("  "),
      EditorView.contentAttributes.of({ style: "tab-size: 2" }),
      languageFor(fileId),
      syntaxHighlighting(highlight, { fallback: true }),
    ],
    [fileId, editable],
  );

  return (
    <CodeMirror
      value={source}
      extensions={extensions}
      readOnly={!editable}
      editable={editable}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        autocompletion: false,
        searchKeymap: editable,
        bracketMatching: editable,
        closeBrackets: editable,
        dropCursor: editable,
        allowMultipleSelections: false,
      }}
      style={{ height: "100%", width: "100%" }}
    />
  );
}

const editableTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      width: "100%",
      fontSize: `${font.size.md}px`,
      fontFamily: font.mono,
      backgroundColor: "transparent",
      color: color.text0,
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      fontFamily: font.mono,
      lineHeight: "1.55",
      overflow: "auto",
    },
    ".cm-content": {
      padding: "6px 0",
      caretColor: color.text0,
    },
    ".cm-line": { padding: "0 10px" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      borderRight: `1px solid ${color.borderSoft}`,
      color: color.text3,
      fontFamily: font.mono,
      fontSize: `${font.size.sm}px`,
      paddingRight: "2px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 6px 0 10px",
      minWidth: "2ch",
    },
    ".cm-activeLine": { backgroundColor: "rgba(10, 10, 10, 0.035)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: color.text1 },
    ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(10, 10, 10, 0.10)" },
    "&.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(10, 10, 10, 0.18)" },
  },
  { dark: false },
);
