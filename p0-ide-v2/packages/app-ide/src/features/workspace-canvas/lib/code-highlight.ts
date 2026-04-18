/**
 * Multi-language syntax tokenizer for the workspace-canvas ground LOD cards.
 *
 * Design goals:
 *   1. Zero runtime dependencies (no shiki / prism) — we render hundreds of
 *      cards and every additional ms of per-card cost is visible in a pan.
 *   2. "Editor-grade" visual result for the common languages: keywords,
 *      strings, numbers, comments, decorators/attributes, types, function
 *      calls get distinct colours on a VS Code Dark+-ish palette.
 *   3. Single-line tokenization with a minimal line-level block-comment
 *      state machine — enough for the code snippets we render (≤ a few
 *      hundred lines) without the complexity of a full scanner.
 *
 * Not a parser. We lose corner cases (nested generics in C++, raw strings
 * in Rust with arbitrary hash counts, template literal nesting). Those
 * degrade to plain text, not to wrong colours.
 */

export type HlClass =
  | "hl-keyword"      // control/declarator keywords (fn, let, class, if, return, …)
  | "hl-type"         // primitive/built-in types (String, i32, bool, Vec, Option, …)
  | "hl-string"       // string / char / template literals
  | "hl-comment"      // // line, # line, /* block */
  | "hl-number"       // integer / float / hex / bin / oct literals
  | "hl-decorator"    // @decorator, #[attr], #define
  | "hl-fn"           // identifier directly followed by '('
  | "hl-op"           // operator runs
  | "hl-punct"        // punctuation we do NOT want to style — kept for future
  | "hl-macro"        // Rust `println!`, C `#include`
  | "hl-constant"     // SCREAMING_SNAKE / true / false / null / None / nil
  | "";               // plain text

export type Token = readonly [cls: HlClass, text: string];

export interface Lang {
  keywords: ReadonlySet<string>;
  types: ReadonlySet<string>;
  constants: ReadonlySet<string>;
  /** Single-line comment prefix. */
  lineComment?: string;
  /** Extra single-line comment prefix (e.g. `//` AND `#` in some hybrids). */
  lineComment2?: string;
  /** Whether slash-star block comments are supported. */
  blockComment?: boolean;
  /** Single quotes delimit strings (vs. chars). */
  singleQuoteString?: boolean;
  /** Backtick template strings (JS/TS). */
  templateString?: boolean;
  /** Macro suffix: `identifier!` as in Rust `println!`. */
  rustMacro?: boolean;
  /** Preprocessor / decorator prefix. */
  decoratorPrefix?: "@" | "#" | "#[" ;
}

// ── Language definitions ─────────────────────────────────────────────

const TS_KEYWORDS = new Set([
  "abstract","as","async","await","break","case","catch","class","const",
  "continue","debugger","default","delete","do","else","enum","export",
  "extends","false","finally","for","from","function","get","if","implements",
  "import","in","instanceof","interface","is","keyof","let","new","null",
  "of","package","private","protected","public","readonly","return","satisfies",
  "set","static","super","switch","this","throw","true","try","type",
  "typeof","undefined","var","void","while","with","yield","declare","module",
  "namespace","override","infer","never","any","unknown","asserts","using",
]);
const TS_TYPES = new Set([
  "string","number","boolean","object","symbol","bigint","Array","Record",
  "Promise","Map","Set","Date","Error","RegExp","ReadonlyArray","Partial",
  "Required","Pick","Omit","Readonly","Exclude","Extract","NonNullable",
  "ReturnType","Parameters","Awaited","React","JSX","HTMLElement","Node",
]);
const TS_CONSTANTS = new Set(["true","false","null","undefined","NaN","Infinity"]);

const RUST_KEYWORDS = new Set([
  "as","async","await","break","const","continue","crate","dyn","else","enum",
  "extern","false","fn","for","if","impl","in","let","loop","match","mod",
  "move","mut","pub","ref","return","self","Self","static","struct","super",
  "trait","true","type","unsafe","use","where","while","abstract","become",
  "box","do","final","macro","override","priv","typeof","unsized","virtual",
  "yield","try","union",
]);
const RUST_TYPES = new Set([
  "i8","i16","i32","i64","i128","isize","u8","u16","u32","u64","u128","usize",
  "f32","f64","bool","char","str","String","Vec","Option","Result","Box",
  "Rc","Arc","Cell","RefCell","Mutex","RwLock","HashMap","HashSet","BTreeMap",
  "BTreeSet","VecDeque","Cow","Path","PathBuf","Duration","Instant",
  "Some","None","Ok","Err","Iterator","IntoIterator","FromIterator","Fn",
  "FnMut","FnOnce","Sized","Send","Sync","Copy","Clone","Debug","Default",
  "Display","Drop","Eq","Hash","Ord","PartialEq","PartialOrd",
]);
const RUST_CONSTANTS = new Set(["true","false","None","Some","Ok","Err"]);

const PY_KEYWORDS = new Set([
  "False","None","True","and","as","assert","async","await","break","class",
  "continue","def","del","elif","else","except","finally","for","from","global",
  "if","import","in","is","lambda","nonlocal","not","or","pass","raise","return",
  "try","while","with","yield","match","case",
]);
const PY_TYPES = new Set([
  "int","str","float","bool","list","dict","set","tuple","bytes","bytearray",
  "frozenset","complex","object","type","Exception","ValueError","TypeError",
  "KeyError","RuntimeError","IndexError","AttributeError","NotImplementedError",
  "Optional","List","Dict","Set","Tuple","Any","Union","Callable","Generator",
  "Iterator","Iterable","Sequence","Mapping","Protocol","Final","TypeVar",
  "ClassVar","Literal","Awaitable","Coroutine","AsyncIterator",
]);
const PY_CONSTANTS = new Set(["True","False","None","self","cls"]);

const GO_KEYWORDS = new Set([
  "break","case","chan","const","continue","default","defer","else","fallthrough",
  "for","func","go","goto","if","import","interface","map","package","range",
  "return","select","struct","switch","type","var",
]);
const GO_TYPES = new Set([
  "bool","byte","complex64","complex128","error","float32","float64","int",
  "int8","int16","int32","int64","rune","string","uint","uint8","uint16",
  "uint32","uint64","uintptr","any",
]);
const GO_CONSTANTS = new Set(["true","false","nil","iota"]);

const JAVA_KEYWORDS = new Set([
  "abstract","assert","break","case","catch","class","const","continue","default",
  "do","else","enum","extends","final","finally","for","goto","if","implements",
  "import","instanceof","interface","native","new","package","private","protected",
  "public","return","static","strictfp","super","switch","synchronized","this",
  "throw","throws","transient","try","volatile","while","var","yield","record",
  "sealed","permits","non-sealed",
]);
const JAVA_TYPES = new Set([
  "boolean","byte","char","double","float","int","long","short","void",
  "String","Integer","Long","Double","Float","Boolean","Character","Object",
  "List","Map","Set","ArrayList","HashMap","HashSet","Optional","Stream",
]);
const JAVA_CONSTANTS = new Set(["true","false","null"]);

const C_KEYWORDS = new Set([
  "alignas","alignof","auto","break","case","catch","class","const","constexpr",
  "continue","decltype","default","delete","do","else","enum","explicit","export",
  "extern","false","final","for","friend","goto","if","inline","mutable","namespace",
  "new","noexcept","nullptr","operator","override","private","protected","public",
  "register","return","sizeof","static","static_assert","static_cast","struct",
  "switch","template","this","thread_local","throw","true","try","typedef","typeid",
  "typename","union","using","virtual","volatile","while","co_await","co_yield",
  "co_return","concept","requires",
]);
const C_TYPES = new Set([
  "bool","char","char8_t","char16_t","char32_t","double","float","int","long",
  "short","signed","unsigned","void","wchar_t","size_t","ptrdiff_t","intptr_t",
  "uintptr_t","int8_t","int16_t","int32_t","int64_t","uint8_t","uint16_t",
  "uint32_t","uint64_t","string","vector","map","unordered_map","set",
  "unordered_set","array","shared_ptr","unique_ptr","weak_ptr",
]);
const C_CONSTANTS = new Set(["true","false","nullptr","NULL"]);

const RUBY_KEYWORDS = new Set([
  "BEGIN","END","alias","and","begin","break","case","class","def","defined?",
  "do","else","elsif","end","ensure","false","for","if","in","module","next",
  "nil","not","or","redo","rescue","retry","return","self","super","then",
  "true","undef","unless","until","when","while","yield","require","require_relative",
  "attr_accessor","attr_reader","attr_writer",
]);
const RUBY_CONSTANTS = new Set(["true","false","nil","self"]);

const JSON_KEYWORDS = new Set<string>(["true","false","null"]);

const SH_KEYWORDS = new Set([
  "if","then","elif","else","fi","case","esac","for","while","until","do","done",
  "in","function","return","export","local","readonly","unset","source","echo",
  "printf","read","test","exit","cd","pwd","ls","mkdir","rm","cp","mv","cat",
  "grep","sed","awk",
]);

const SQL_KEYWORDS = new Set([
  "SELECT","FROM","WHERE","INSERT","UPDATE","DELETE","CREATE","DROP","ALTER",
  "TABLE","INDEX","VIEW","JOIN","LEFT","RIGHT","INNER","OUTER","ON","AS","AND",
  "OR","NOT","NULL","IS","IN","BETWEEN","LIKE","GROUP","BY","ORDER","HAVING",
  "LIMIT","OFFSET","UNION","ALL","DISTINCT","INTO","VALUES","SET","RETURNING",
  "WITH","CASE","WHEN","THEN","ELSE","END","PRIMARY","KEY","FOREIGN","REFERENCES",
  "DEFAULT","UNIQUE","CHECK","CONSTRAINT",
]);

const CSS_KEYWORDS = new Set([
  "important","inherit","initial","unset","revert","auto","none","normal",
]);

const TS_LANG: Lang = {
  keywords: TS_KEYWORDS, types: TS_TYPES, constants: TS_CONSTANTS,
  lineComment: "//", blockComment: true, singleQuoteString: true,
  templateString: true, decoratorPrefix: "@",
};
const RUST_LANG: Lang = {
  keywords: RUST_KEYWORDS, types: RUST_TYPES, constants: RUST_CONSTANTS,
  lineComment: "//", blockComment: true, singleQuoteString: true,
  rustMacro: true, decoratorPrefix: "#[",
};
const PY_LANG: Lang = {
  keywords: PY_KEYWORDS, types: PY_TYPES, constants: PY_CONSTANTS,
  lineComment: "#", blockComment: false, singleQuoteString: true,
  decoratorPrefix: "@",
};
const GO_LANG: Lang = {
  keywords: GO_KEYWORDS, types: GO_TYPES, constants: GO_CONSTANTS,
  lineComment: "//", blockComment: true, singleQuoteString: true,
};
const JAVA_LANG: Lang = {
  keywords: JAVA_KEYWORDS, types: JAVA_TYPES, constants: JAVA_CONSTANTS,
  lineComment: "//", blockComment: true, singleQuoteString: true,
  decoratorPrefix: "@",
};
const C_LANG: Lang = {
  keywords: C_KEYWORDS, types: C_TYPES, constants: C_CONSTANTS,
  lineComment: "//", blockComment: true, singleQuoteString: true,
  decoratorPrefix: "#",
};
const RUBY_LANG: Lang = {
  keywords: RUBY_KEYWORDS, types: new Set(), constants: RUBY_CONSTANTS,
  lineComment: "#", blockComment: false, singleQuoteString: true,
};
const JSON_LANG: Lang = {
  keywords: JSON_KEYWORDS, types: new Set(), constants: JSON_KEYWORDS,
  lineComment: undefined, blockComment: false, singleQuoteString: false,
};
const SH_LANG: Lang = {
  keywords: SH_KEYWORDS, types: new Set(), constants: new Set(),
  lineComment: "#", blockComment: false, singleQuoteString: true,
};
const SQL_LANG: Lang = {
  keywords: SQL_KEYWORDS, types: new Set(), constants: new Set(),
  lineComment: "--", blockComment: true, singleQuoteString: true,
};
const CSS_LANG: Lang = {
  keywords: CSS_KEYWORDS, types: new Set(), constants: new Set(),
  lineComment: undefined, blockComment: true, singleQuoteString: true,
};
const YAML_LANG: Lang = {
  keywords: new Set(["true","false","null","yes","no","on","off"]),
  types: new Set(), constants: new Set(["true","false","null"]),
  lineComment: "#", blockComment: false, singleQuoteString: true,
};
const MD_LANG: Lang = {
  keywords: new Set(), types: new Set(), constants: new Set(),
  lineComment: undefined, blockComment: false, singleQuoteString: false,
};
const PLAIN_LANG: Lang = {
  keywords: new Set(), types: new Set(), constants: new Set(),
  lineComment: undefined, blockComment: false, singleQuoteString: false,
};

const EXT_TO_LANG: Record<string, Lang> = {
  ts: TS_LANG, tsx: TS_LANG, js: TS_LANG, jsx: TS_LANG, mjs: TS_LANG, cjs: TS_LANG,
  rs: RUST_LANG,
  py: PY_LANG, pyi: PY_LANG,
  go: GO_LANG,
  java: JAVA_LANG, kt: JAVA_LANG, kts: JAVA_LANG, scala: JAVA_LANG,
  c: C_LANG, h: C_LANG, cc: C_LANG, cpp: C_LANG, cxx: C_LANG, hpp: C_LANG, hxx: C_LANG, m: C_LANG, mm: C_LANG,
  rb: RUBY_LANG,
  json: JSON_LANG,
  sh: SH_LANG, bash: SH_LANG, zsh: SH_LANG, fish: SH_LANG,
  sql: SQL_LANG,
  css: CSS_LANG, scss: CSS_LANG, sass: CSS_LANG, less: CSS_LANG,
  yaml: YAML_LANG, yml: YAML_LANG, toml: YAML_LANG,
  md: MD_LANG, mdx: MD_LANG,
  html: CSS_LANG, htm: CSS_LANG, xml: CSS_LANG, svg: CSS_LANG,
};

export function langFromFilename(name: string): Lang {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return PLAIN_LANG;
  const ext = name.slice(dot + 1).toLowerCase();
  return EXT_TO_LANG[ext] ?? PLAIN_LANG;
}

// ── Tokenizer ─────────────────────────────────────────────────────────

const OP_CHARS = "+-*/%=<>!&|^~?:";
const IDENT_START = /[A-Za-z_$]/;
const IDENT_CONT = /[\w$]/;
const DIGIT = /\d/;
const SCREAMING = /^[A-Z][A-Z0-9_]+$/;

interface LineState {
  /** True if we entered this line inside a `/* … *​/` block comment. */
  inBlockComment: boolean;
}

export const INITIAL_STATE: LineState = { inBlockComment: false };

/** Tokenize one line. Returns the tokens + next line's starting state. */
export function tokenizeLine(
  line: string,
  lang: Lang,
  state: LineState = INITIAL_STATE,
): { tokens: Token[]; next: LineState } {
  const tokens: Token[] = [];
  let i = 0;
  let inBlock = state.inBlockComment;

  // Resume block comment from previous line.
  if (inBlock) {
    const end = line.indexOf("*/");
    if (end === -1) {
      if (line.length > 0) tokens.push(["hl-comment", line]);
      return { tokens, next: { inBlockComment: true } };
    }
    tokens.push(["hl-comment", line.slice(0, end + 2)]);
    i = end + 2;
    inBlock = false;
  }

  while (i < line.length) {
    const ch = line[i];
    const rest = line.slice(i);

    // Block comment start
    if (lang.blockComment && ch === "/" && line[i + 1] === "*") {
      const end = line.indexOf("*/", i + 2);
      if (end === -1) {
        tokens.push(["hl-comment", line.slice(i)]);
        return { tokens, next: { inBlockComment: true } };
      }
      tokens.push(["hl-comment", line.slice(i, end + 2)]);
      i = end + 2;
      continue;
    }

    // Line comment
    if (lang.lineComment && rest.startsWith(lang.lineComment)) {
      tokens.push(["hl-comment", line.slice(i)]);
      break;
    }
    if (lang.lineComment2 && rest.startsWith(lang.lineComment2)) {
      tokens.push(["hl-comment", line.slice(i)]);
      break;
    }

    // Attribute/decorator: Rust #[derive(Debug)], TS/Py/Java @decorator, C/CPP #include
    if (lang.decoratorPrefix === "#[" && ch === "#" && line[i + 1] === "[") {
      const end = findMatchingBracket(line, i + 1);
      if (end !== -1) {
        tokens.push(["hl-decorator", line.slice(i, end + 1)]);
        i = end + 1;
        continue;
      }
    }
    if (lang.decoratorPrefix === "@" && ch === "@") {
      let j = i + 1;
      while (j < line.length && /[\w.]/.test(line[j])) j++;
      if (j > i + 1) {
        tokens.push(["hl-decorator", line.slice(i, j)]);
        i = j;
        continue;
      }
    }
    if (lang.decoratorPrefix === "#" && ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) {
      // Include whole line as pre-processor.
      tokens.push(["hl-decorator", line.slice(i)]);
      break;
    }

    // Template literals (JS/TS) — single line, no interpolation highlighting
    if (lang.templateString && ch === "`") {
      let j = i + 1;
      while (j < line.length && line[j] !== "`") {
        if (line[j] === "\\") j++;
        j++;
      }
      tokens.push(["hl-string", line.slice(i, Math.min(j + 1, line.length))]);
      i = j + 1;
      continue;
    }

    // Double-quoted string (including Rust byte strings b"…")
    if (ch === '"' || (lang.singleQuoteString && ch === "'")) {
      const q = ch;
      let j = i + 1;
      while (j < line.length && line[j] !== q) {
        if (line[j] === "\\") j++;
        j++;
      }
      tokens.push(["hl-string", line.slice(i, Math.min(j + 1, line.length))]);
      i = j + 1;
      continue;
    }

    // Number: integer, float, hex, bin, oct. Keep it strict enough to avoid
    // swallowing identifier suffixes in Rust (1_000u32) while still tagging.
    if (
      DIGIT.test(ch) ||
      (ch === "." && DIGIT.test(line[i + 1] ?? ""))
    ) {
      let j = i;
      // hex / bin / oct prefix
      if (ch === "0" && /[xXbBoO]/.test(line[i + 1] ?? "")) {
        j = i + 2;
        while (j < line.length && /[\dA-Fa-f_]/.test(line[j])) j++;
      } else {
        while (j < line.length && /[\d_]/.test(line[j])) j++;
        if (line[j] === "." && DIGIT.test(line[j + 1] ?? "")) {
          j++;
          while (j < line.length && /[\d_]/.test(line[j])) j++;
        }
        if (/[eE]/.test(line[j] ?? "")) {
          j++;
          if (line[j] === "+" || line[j] === "-") j++;
          while (j < line.length && DIGIT.test(line[j])) j++;
        }
      }
      // numeric suffix (Rust i32/u64/f32, JS/TS n, C LL/UL)
      while (j < line.length && /[iIuUfFlLnN\d]/.test(line[j]) && !IDENT_START.test(line[j + 1] ?? "")) {
        j++;
      }
      tokens.push(["hl-number", line.slice(i, j)]);
      i = j;
      continue;
    }

    // Identifier / keyword / type / fn call / macro
    if (IDENT_START.test(ch)) {
      let j = i;
      while (j < line.length && IDENT_CONT.test(line[j])) j++;
      const word = line.slice(i, j);

      // Rust macro: foo!(…) or foo![ … ]
      if (lang.rustMacro && (line[j] === "!") && /[([{]/.test(line[j + 1] ?? "")) {
        tokens.push(["hl-macro", word + "!"]);
        i = j + 1;
        continue;
      }

      if (lang.keywords.has(word)) {
        tokens.push(["hl-keyword", word]);
      } else if (lang.constants.has(word)) {
        tokens.push(["hl-constant", word]);
      } else if (lang.types.has(word)) {
        tokens.push(["hl-type", word]);
      } else if (SCREAMING.test(word)) {
        tokens.push(["hl-constant", word]);
      } else if (line[j] === "(") {
        tokens.push(["hl-fn", word]);
      } else if (/^[A-Z]/.test(word)) {
        // Heuristic: CapitalizedIdent → type-ish (React components,
        // Rust structs/enums, Java classes).
        tokens.push(["hl-type", word]);
      } else {
        tokens.push(["", word]);
      }
      i = j;
      continue;
    }

    // Operator run
    if (OP_CHARS.includes(ch)) {
      let j = i;
      while (j < line.length && OP_CHARS.includes(line[j])) j++;
      tokens.push(["hl-op", line.slice(i, j)]);
      i = j;
      continue;
    }

    // Whitespace / punctuation / anything else — pass through.
    let j = i;
    while (
      j < line.length &&
      !IDENT_START.test(line[j]) &&
      !DIGIT.test(line[j]) &&
      !OP_CHARS.includes(line[j]) &&
      line[j] !== '"' &&
      !(lang.singleQuoteString && line[j] === "'") &&
      !(lang.templateString && line[j] === "`") &&
      !(lang.lineComment && line.slice(j).startsWith(lang.lineComment)) &&
      !(lang.blockComment && line[j] === "/" && line[j + 1] === "*")
    ) j++;
    if (j === i) j = i + 1;
    tokens.push(["", line.slice(i, j)]);
    i = j;
  }

  return { tokens, next: { inBlockComment: inBlock } };
}

// Find matching `]` for a `[` at index `start`. Respects nested brackets and
// quotes — needed so `#[derive(Debug, Clone)]` tokenises as one attribute.
function findMatchingBracket(line: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < line.length) {
    const c = line[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return i;
    } else if (c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < line.length && line[i] !== q) {
        if (line[i] === "\\") i++;
        i++;
      }
    }
    i++;
  }
  return -1;
}

/** Tokenize an entire source string line-by-line, threading block state. */
export function tokenizeSource(source: string, lang: Lang): Token[][] {
  const lines = source.split("\n");
  const out: Token[][] = [];
  let state: LineState = INITIAL_STATE;
  for (const line of lines) {
    const r = tokenizeLine(line, lang, state);
    out.push(r.tokens);
    state = r.next;
  }
  return out;
}
