import { StreamLanguage, type StreamParser } from "@codemirror/language";

// Multi-language StreamLanguage
// --------------------------------------------------------------------
// A pragmatic tokenizer covering the languages we actually ship at
// file tier today (Rust, TypeScript/JavaScript, Python, Go, Java, C/
// C++). Each lang is a keyword set + a shared token stream (strings,
// comments, numbers, identifiers, operators). Returns CodeMirror tag
// names so `defaultHighlightStyle` paints them.
//
// Why StreamLanguage and not `@codemirror/lang-*`: the product ships
// as a bundled artifact, we want zero additional lang dependencies,
// and at file-tier the viewer is read-only — perfect-AST is overkill.
// StreamLanguage tokenizes line-by-line with a tiny state machine;
// bundle cost is ~2 kB gz for every language below combined.

type Lang =
  | "rust" | "ts" | "tsx" | "js" | "jsx"
  | "py" | "go" | "java" | "c" | "cpp"
  | "json" | "plain";

const KW_RUST = new Set(
  "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type union unsafe use where while yield".split(" "),
);
const KW_TS = new Set(
  "abstract as async await break case catch class const constructor continue debugger declare default delete do else enum export extends false finally for from function get if implements import in instanceof interface is keyof let new null of package private protected public readonly return satisfies set static super switch this throw true try type typeof undefined var void while with yield".split(" "),
);
const KW_PY = new Set(
  "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield match case".split(" "),
);
const KW_GO = new Set(
  "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil".split(" "),
);
const KW_JAVA = new Set(
  "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new null package private protected public return short static strictfp super switch synchronized this throw throws transient true false try void volatile while var".split(" "),
);
const KW_C = new Set(
  "auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while _Bool _Complex _Imaginary true false NULL".split(" "),
);
const KW_CPP = new Set([
  ...KW_C,
  ...("alignas alignof and and_eq asm bitand bitor bool catch char16_t char32_t class compl concept constexpr const_cast decltype delete dynamic_cast explicit export friend mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public reinterpret_cast requires static_assert static_cast template this thread_local throw try typeid typename using virtual wchar_t xor xor_eq".split(" ")),
]);

function kwSetFor(lang: Lang): Set<string> | null {
  switch (lang) {
    case "rust": return KW_RUST;
    case "ts":
    case "tsx":
    case "js":
    case "jsx":   return KW_TS;
    case "py":    return KW_PY;
    case "go":    return KW_GO;
    case "java":  return KW_JAVA;
    case "c":     return KW_C;
    case "cpp":   return KW_CPP;
    default:      return null;
  }
}

interface State {
  inBlockComment: boolean;
  // Rust raw-string / TS template-literal depth. Kept simple — single
  // level is enough for 99% of files.
  inTemplate: boolean;
}

function start(): State {
  return { inBlockComment: false, inTemplate: false };
}

function copy(s: State): State {
  return { inBlockComment: s.inBlockComment, inTemplate: s.inTemplate };
}

function makeParser(lang: Lang): StreamParser<State> {
  const kws = kwSetFor(lang);
  const lineCmt = lang === "py" ? "#" : "//";
  const allowBlockCmt = lang !== "py";
  const allowTemplate = lang === "ts" || lang === "tsx" || lang === "js" || lang === "jsx";
  const allowRustRaw = lang === "rust";

  return {
    name: lang,
    startState: start,
    copyState: copy,
    token(stream, state) {
      if (state.inBlockComment) {
        while (!stream.eol()) {
          if (stream.match("*/")) {
            state.inBlockComment = false;
            return "blockComment";
          }
          stream.next();
        }
        return "blockComment";
      }
      if (state.inTemplate && allowTemplate) {
        while (!stream.eol()) {
          if (stream.match("`")) {
            state.inTemplate = false;
            return "string";
          }
          if (stream.match("\\`") || stream.match("\\\\")) continue;
          stream.next();
        }
        return "string";
      }

      if (stream.eatSpace()) return null;

      // Line comment
      if (stream.match(lineCmt)) {
        stream.skipToEnd();
        return "lineComment";
      }
      // Block comment
      if (allowBlockCmt && stream.match("/*")) {
        state.inBlockComment = true;
        return "blockComment";
      }
      // Python triple-string — treat as regular string on the same line
      // for simplicity. Multi-line triple-strings fall back to default
      // tokens; acceptable for a file-tier viewer.
      if (lang === "py" && (stream.match('"""') || stream.match("'''"))) {
        stream.skipToEnd();
        return "string";
      }

      // Strings
      const ch = stream.peek();
      if (ch === '"' || ch === "'") {
        const quote = ch;
        stream.next();
        while (!stream.eol()) {
          const n = stream.next();
          if (n === "\\") { stream.next(); continue; }
          if (n === quote) break;
        }
        return "string";
      }
      if (allowTemplate && stream.match("`")) {
        state.inTemplate = true;
        return "string";
      }
      if (allowRustRaw && stream.match(/^r#*"/)) {
        // Rust raw-string — swallow to closing `"#*`. Simplification:
        // stop at first `"` on the same line.
        while (!stream.eol()) {
          if (stream.next() === '"') break;
        }
        return "string";
      }

      // Rust attributes / decorators / TS decorators
      if (stream.match(/^#!?\[[^\]]*\]/)) return "meta";
      if (stream.match(/^@[A-Za-z_][A-Za-z0-9_]*/)) return "meta";

      // Numbers (ints, floats, hex, underscore separators, suffixes)
      if (stream.match(/^0x[0-9a-fA-F_]+[a-zA-Z0-9_]*/)) return "number";
      if (stream.match(/^0b[01_]+[a-zA-Z0-9_]*/)) return "number";
      if (stream.match(/^[0-9][0-9_]*(\.[0-9_]+)?([eE][+-]?[0-9_]+)?[a-zA-Z0-9_]*/)) {
        return "number";
      }

      // Identifiers / keywords
      if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
        const word = stream.current();
        if (kws?.has(word)) return "keyword";
        // Heuristics: capitalized → type-ish; followed by `(` → function
        // call / definition. Rough but reads well for glance-viewing.
        if (/^[A-Z]/.test(word)) return "typeName";
        if (stream.peek() === "(") return "function(variableName)";
        return null;
      }

      // Operators & punctuation
      if (stream.match(/^[+\-*/%=<>!&|^~?:.,;[\](){}]/)) return "punctuation";

      stream.next();
      return null;
    },
  };
}

const parsers = new Map<Lang, StreamLanguage<State>>();
function parserFor(lang: Lang): StreamLanguage<State> {
  let p = parsers.get(lang);
  if (!p) {
    p = StreamLanguage.define(makeParser(lang));
    parsers.set(lang, p);
  }
  return p;
}

export function langFromPath(path: string): Lang {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "plain";
  const ext = path.slice(dot + 1).toLowerCase();
  switch (ext) {
    case "rs":    return "rust";
    case "ts":    return "ts";
    case "tsx":   return "tsx";
    case "js":
    case "mjs":
    case "cjs":   return "js";
    case "jsx":   return "jsx";
    case "py":    return "py";
    case "go":    return "go";
    case "java":  return "java";
    case "c":
    case "h":     return "c";
    case "cc":
    case "cpp":
    case "cxx":
    case "hpp":
    case "hh":
    case "hxx":   return "cpp";
    case "json":  return "json";
    default:      return "plain";
  }
}

export function languageFor(path: string): StreamLanguage<State> {
  return parserFor(langFromPath(path));
}
