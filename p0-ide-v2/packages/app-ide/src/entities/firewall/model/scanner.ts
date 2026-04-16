import type { ScanHit, ScanPatternId, ScanResult } from "./types";

type Pattern = {
  id: ScanPatternId;
  test: (text: string) => { match: boolean; excerpt?: string; confidence: number };
};

const OVERRIDE_RE = /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|rules|prompts?|messages?)\b/i;
const SYSTEM_RE = /\b(system\s*:|new\s+instructions?|override\s*:)/i;
const ROLE_RE = /\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be|role[- ]?play\s+as)\b/i;
const PROMPT_LEAK_RE = /\b(show|reveal|print|output)\s+(me\s+)?your\s+(system\s+)?(prompt|instructions?|rules)\b/i;
const EXEC_RE = /\b(rm\s+-rf|drop\s+table|;\s*\$\(|curl\s+\|.*sh|wget\s+\|.*sh)\b/i;
const URL_OBF_RE = /(javascript:|data:text\/html|%00|%0a|\\x[0-9a-f]{2})/i;
const BASE64_RE = /(?:[A-Za-z0-9+/]{40,}={0,2})/;
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u2060]/;

const PATTERNS: Pattern[] = [
  {
    id: "override-instruction",
    test: (t) => {
      const m = t.match(OVERRIDE_RE) ?? t.match(SYSTEM_RE);
      return m ? { match: true, excerpt: m[0], confidence: 0.92 } : { match: false, confidence: 0 };
    },
  },
  {
    id: "role-switch",
    test: (t) => {
      const m = t.match(ROLE_RE);
      return m ? { match: true, excerpt: m[0], confidence: 0.78 } : { match: false, confidence: 0 };
    },
  },
  {
    id: "prompt-leak-request",
    test: (t) => {
      const m = t.match(PROMPT_LEAK_RE);
      return m ? { match: true, excerpt: m[0], confidence: 0.88 } : { match: false, confidence: 0 };
    },
  },
  {
    id: "executable-intent",
    test: (t) => {
      const m = t.match(EXEC_RE);
      return m ? { match: true, excerpt: m[0], confidence: 0.85 } : { match: false, confidence: 0 };
    },
  },
  {
    id: "url-obfuscation",
    test: (t) => {
      const m = t.match(URL_OBF_RE);
      return m ? { match: true, excerpt: m[0], confidence: 0.72 } : { match: false, confidence: 0 };
    },
  },
  {
    id: "base64-payload",
    test: (t) => {
      const m = t.match(BASE64_RE);
      if (!m) return { match: false, confidence: 0 };
      return { match: true, excerpt: m[0].slice(0, 24) + "…", confidence: 0.64 };
    },
  },
  {
    id: "hidden-whitespace",
    test: (t) => {
      if (!ZERO_WIDTH_RE.test(t)) return { match: false, confidence: 0 };
      return { match: true, excerpt: "zero-width chars", confidence: 0.81 };
    },
  },
];

export function scanText(text: string): ScanResult {
  const hits: ScanHit[] = [];
  for (const p of PATTERNS) {
    const r = p.test(text);
    if (r.match) {
      hits.push({ patternId: p.id, confidence: r.confidence, excerpt: r.excerpt });
    }
  }
  return { suspicious: hits.length > 0, hits };
}
