import {
  StreamLanguage,
  defaultHighlightStyle,
  syntaxHighlighting,
  indentUnit,
} from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tokenizeLine, langFromFilename, type Lang, type HlClass } from "../../lib/code-highlight";

// Inline editor highlighter
// -------------------------------------------------------------------
// Builds a CodeMirror StreamLanguage that delegates per-line tokenization
// to our existing `tokenizeLine` (same function the read-only GroundCard
// uses). This keeps edit and read-only modes visually close and gives us
// TS / JS / Python / Rust / Go / Java / C++ / Ruby / JSON / Shell / SQL /
// CSS / YAML / Markdown coloring without adding any new lang-* packages.
//
// The StreamParser returns CodeMirror tag names as strings — CM resolves
// them against the active HighlightStyle. We layer `defaultHighlightStyle`
// so colors land on a sensible palette out of the box, and add a thin
// CSS-variable override for VS Code Dark+ alignment with read-only cards.

interface LineState {
  inBlockComment: boolean;
}

function hlClassToCmTag(cls: HlClass): string | null {
  switch (cls) {
    case "hl-keyword":   return "keyword";
    case "hl-type":      return "typeName";
    case "hl-string":    return "string";
    case "hl-comment":   return "lineComment";
    case "hl-number":    return "number";
    case "hl-decorator": return "meta";
    case "hl-fn":        return "function(variableName)";
    case "hl-op":        return "operator";
    case "hl-punct":     return "punctuation";
    case "hl-macro":     return "macroName";
    case "hl-constant":  return "atom";
    default:             return null;
  }
}

function createStreamLanguageForLang(lang: Lang, name: string) {
  return StreamLanguage.define<LineState>({
    name,
    startState(): LineState {
      return { inBlockComment: false };
    },
    token(stream, state) {
      if (stream.eol()) return null;
      // Re-tokenize the whole line each call (pure, cheap). Then advance
      // the stream past the token covering the current position.
      const res = tokenizeLine(stream.string, lang, state);
      let offset = 0;
      for (const [cls, text] of res.tokens) {
        if (text.length === 0) continue;
        if (stream.pos < offset + text.length) {
          stream.pos = offset + text.length;
          if (stream.eol()) state.inBlockComment = res.next.inBlockComment;
          return hlClassToCmTag(cls);
        }
        offset += text.length;
      }
      stream.skipToEnd();
      state.inBlockComment = res.next.inBlockComment;
      return null;
    },
    copyState(s): LineState {
      return { inBlockComment: s.inBlockComment };
    },
  });
}

/**
 * Language + highlight bundle for a given filename. Falls back to a
 * plain-text StreamLanguage when the extension is unknown; coloring is
 * still applied (no-op tokens) so tag rules don't error. Colors come
 * from CM's `defaultHighlightStyle`, which ships a sensible dark-
 * leaning palette that matches our overall theme tone.
 */
export function languageExtensionsFor(filename: string) {
  const lang = langFromFilename(filename);
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  const stream = createStreamLanguageForLang(lang, ext || "plain");
  return [
    stream,
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    indentUnit.of("  "),
    EditorView.contentAttributes.of({ style: "tab-size: 2" }),
  ];
}
