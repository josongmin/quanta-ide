/**
 * Lightweight Python syntax tokenizer for canvas code pane.
 * Returns an array of [className, text] spans for a single line.
 * NOT a full parser — covers keywords, strings, comments, numbers, decorators.
 */

type Token = [cls: string, text: string];

const KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await",
  "break", "class", "continue", "def", "del", "elif", "else", "except",
  "finally", "for", "from", "global", "if", "import", "in", "is",
  "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
  "try", "while", "with", "yield",
]);

const BUILTINS = new Set([
  "print", "len", "range", "int", "str", "float", "bool", "list",
  "dict", "set", "tuple", "type", "isinstance", "hasattr", "getattr",
  "setattr", "super", "property", "staticmethod", "classmethod",
  "enumerate", "zip", "map", "filter", "sorted", "reversed",
  "min", "max", "sum", "abs", "round", "open", "Exception",
  "ValueError", "TypeError", "KeyError", "RuntimeError",
  "Optional", "List", "Dict", "Set", "Tuple", "Any", "Union",
  "Callable", "Generator", "Protocol", "Final", "TypeVar",
  "Sequence", "Record",
]);

export function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Comment
    if (line[i] === "#") {
      tokens.push(["hl-comment", line.slice(i)]);
      break;
    }

    // Triple-quoted string (partial — just the start on this line)
    if (line.slice(i, i + 3) === '"""' || line.slice(i, i + 3) === "'''") {
      const q = line.slice(i, i + 3);
      const end = line.indexOf(q, i + 3);
      if (end !== -1) {
        tokens.push(["hl-string", line.slice(i, end + 3)]);
        i = end + 3;
      } else {
        tokens.push(["hl-string", line.slice(i)]);
        break;
      }
      continue;
    }

    // String
    if (line[i] === '"' || line[i] === "'") {
      const q = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== q) {
        if (line[j] === "\\") j++;
        j++;
      }
      tokens.push(["hl-string", line.slice(i, j + 1)]);
      i = j + 1;
      continue;
    }

    // Decorator
    if (line[i] === "@" && (i === 0 || /\s/.test(line[i - 1]))) {
      let j = i + 1;
      while (j < line.length && /[\w.]/.test(line[j])) j++;
      tokens.push(["hl-decorator", line.slice(i, j)]);
      i = j;
      continue;
    }

    // Number
    if (/\d/.test(line[i]) && (i === 0 || /[\s(,=\[{:+\-*/<>!]/.test(line[i - 1]))) {
      let j = i;
      while (j < line.length && /[\d._xXoObBeE]/.test(line[j])) j++;
      tokens.push(["hl-number", line.slice(i, j)]);
      i = j;
      continue;
    }

    // Word (keyword / builtin / identifier)
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[\w]/.test(line[j])) j++;
      const word = line.slice(i, j);
      if (KEYWORDS.has(word)) {
        tokens.push(["hl-keyword", word]);
      } else if (BUILTINS.has(word)) {
        tokens.push(["hl-builtin", word]);
      } else if (j < line.length && line[j] === "(") {
        tokens.push(["hl-fn", word]);
      } else if (word === "self") {
        tokens.push(["hl-self", word]);
      } else {
        tokens.push(["", word]);
      }
      i = j;
      continue;
    }

    // Operator
    if (/[+\-*/%=<>!&|^~]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[+\-*/%=<>!&|^~]/.test(line[j])) j++;
      tokens.push(["hl-op", line.slice(i, j)]);
      i = j;
      continue;
    }

    // Punctuation / whitespace / other — pass through
    let j = i;
    while (j < line.length && !/[a-zA-Z_\d"'#@+\-*/%=<>!&|^~]/.test(line[j])) j++;
    if (j === i) j = i + 1;
    tokens.push(["", line.slice(i, j)]);
    i = j;
  }

  return tokens;
}
