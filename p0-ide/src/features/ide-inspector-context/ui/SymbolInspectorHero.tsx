import type { SymbolContext } from "../model/useInspectorContext";
import { useInspectorContext } from "../model/useInspectorContext";

// ── helpers (shared with SymbolInspector) ────────────────────────────────────

function taintInfo(t: string): { label: string; color: string; icon: string } {
  if (t === "source") return { label: "TAINT SOURCE", color: "var(--token-str)", icon: "⬆" };
  if (t === "sink")   return { label: "TAINT SINK",   color: "var(--token-err)", icon: "⬇" };
  return                       { label: "PASSTHROUGH", color: "var(--ink-3)",     icon: "↔" };
}

function riskColor(score: number) {
  if (score >= 70) return "var(--token-err)";
  if (score >= 40) return "var(--token-str)";
  return "var(--token-ok)";
}

const KIND_GLYPHS: Record<string, string> = {
  "function":        "ƒ",
  "method":          "ƒ",
  "constructor":     "I",
  "abstract-method": "A",
  "lambda":          "λ",
  "generator":       "∗",
  "getter":          "g",
  "setter":          "s",
  "overload":        "⊕",
  "operator":        "±",
  "class":           "C",
  "struct":          "S",
  "interface":       "«",
  "enum":            "E",
  "type-alias":      "~",
  "type-parameter":  "T",
  "type-guard":      "?",
  "variable":        "v",
  "const":           "π",
  "parameter":       "p",
  "field":           "#",
  "property":        "·",
  "enum-member":     "e",
  "module":          "◈",
  "import":          "◈",
  "call-site":       "→",
  "decorator":       "@",
  "event":           "⚡",
  "exception":       "✕",
  "type":            "T",
};

const TAG_LABEL: Record<string, string> = {
  "dead":       "dead code",
  "no-tests":   "no tests",
  "external":   "external",
  "hot-path":   "hot path",
  "write":      "db write",
  "async":      "async",
  "stale":      "stale",
  "taint-source": "taint src",
  "high-churn": "high churn",
};

// ── sub-blocks ───────────────────────────────────────────────────────────────

function TagsBlock({ ctx }: { ctx: SymbolContext }) {
  if (!ctx.tags?.length) return null;
  return (
    <div className="sii-tags-row">
      {ctx.tags.map((tag) => (
        <span key={tag} className={`sii-tag sii-tag-${tag}`}>{TAG_LABEL[tag] ?? tag}</span>
      ))}
    </div>
  );
}

function DetailBlock({ ctx }: { ctx: SymbolContext }) {
  if (!ctx.detail) return null;
  return <p className="sii-detail-text">{ctx.detail}</p>;
}

// ── SymbolInspectorHero ──────────────────────────────────────────────────────

export interface SymbolInspectorHeroProps {
  ctx: SymbolContext;
}

export function SymbolInspectorHero({ ctx }: SymbolInspectorHeroProps) {
  const { resetToFile } = useInspectorContext();

  const cpx = ctx.complexity ?? 0;
  const riskScore = ctx.riskScore ?? (cpx >= 8 ? 78 : cpx >= 5 ? 52 : 23);
  const taint = ctx.taint ? taintInfo(ctx.taint) : null;
  const glyph = KIND_GLYPHS[ctx.kind] ?? "·";
  const rc = riskColor(riskScore);

  return (
    <div className="sii-hero">
      <button
        type="button"
        className="sii-back"
        onClick={() => { resetToFile(ctx.fileName); }}
        aria-label={`Back to ${ctx.fileName}`}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span className="sii-back-file">{ctx.fileName}</span>
        <span className="sii-back-sep">/</span>
        <span className="sii-back-sym">{ctx.name}</span>
      </button>

      <div className="sii-identity">
        <span className="sii-kind-glyph">{glyph}</span>
        <span className="sii-hero-name">{ctx.name}</span>
        <span className="sii-kind-pill">{ctx.kind}</span>
        <span className="sii-risk-badge" style={{ color: rc, borderColor: rc }}>
          RISK {riskScore}
        </span>
      </div>

      <div className="sii-meta-row">
        {taint && (
          <span className={`sii-taint-pill sii-taint-${ctx.taint}`}>
            {taint.icon} {taint.label}
          </span>
        )}
        {ctx.blame && (
          <span className="sii-blame-inline">
            <span className="sii-blame-avatar">{ctx.blame.author.replace("@", "")[0].toUpperCase()}</span>
            <span className="sii-blame-who">{ctx.blame.author}</span>
            <span className="sii-blame-dot">·</span>
            <span className="sii-blame-when">{ctx.blame.when}</span>
          </span>
        )}
      </div>

      <TagsBlock ctx={ctx} />
      <DetailBlock ctx={ctx} />
    </div>
  );
}
