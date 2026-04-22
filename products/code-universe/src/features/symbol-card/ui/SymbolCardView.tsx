// SymbolCardView — hero card for a single symbol.
// --------------------------------------------------------------------
// Reference: Sourcetrail symbol-detail pane; LSP "peek definition".
//
// Layout (top → bottom):
//   1. Symbol-selector strip — horizontally scrollable chips of every
//      symbol in the currently-selected file. Clicking a chip swaps the
//      focused symbol locally (no store write — the selection in the
//      shell stays on the file).
//   2. Signature line — `public function parseInput(...)` monospaced.
//   3. Mini-stats row — LoC · CC · CogC · visibility pill · `called by N`
//      · `calls N` · `tests N`.
//   4. Two-column body:
//        (left)  Definition preview — 8..14 lines of mock function body
//                in monospace. Reads as a peek-definition block.
//        (right) Tests panel — list of tests that cover this symbol.
//
// Default focused symbol = the file's highest-cyclomatic symbol. User
// can click chips to swap. All data is synthesized via
// `symbolsInFile()` / `testsForSymbol()` so callers get stable,
// deterministic output.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import {
  hashId,
  seeded,
  symbolsInFile,
  testsForSymbol,
  type SymbolVisibility,
  type SynthSymbol,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;

const KEYFRAMES = `
@keyframes sc-enter {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes sc-rise {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

// ── Synthesized function-body preview ────────────────────────────────
// A tiny generator that mixes familiar tokens (guards / assignments /
// loops / returns) so the "peek definition" block reads like real
// source instead of lorem ipsum. Deterministic per symbol.
const BODY_LINE_TEMPLATES: readonly string[] = [
  "if (!input) throw new Error(\"missing input\");",
  "const next = options.mode ?? defaults.mode;",
  "for (const entry of input.entries) {",
  "  result.push(normalize(entry));",
  "}",
  "const parsed = this.parser.parse(raw);",
  "if (parsed.kind === \"error\") return parsed;",
  "await this.store.commit(parsed);",
  "const cached = this.cache.get(key);",
  "if (cached) return cached;",
  "this.telemetry.emit(\"resolved\", { key });",
  "return { ok: true, value };",
  "const deps = [...this.graph.edges].filter(matches);",
  "while (stack.length > 0) {",
  "  const head = stack.pop()!;",
  "  visited.add(head.id);",
  "}",
  "this.buffer.flush();",
  "// early return — nothing to do",
  "return undefined;",
];
function buildBody(sym: SynthSymbol): string[] {
  const rng = seeded(sym.id, "body");
  const n = 8 + Math.floor(rng() * 7); // 8..14 lines
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = BODY_LINE_TEMPLATES[Math.floor(rng() * BODY_LINE_TEMPLATES.length)]!;
    out.push(t);
  }
  return out;
}

function visibilityTint(v: SymbolVisibility): { bg: string; fg: string } {
  switch (v) {
    case "public":   return { bg: "rgba(13,153,255,0.10)", fg: color.accent };
    case "internal": return { bg: color.bg3,               fg: color.text1 };
    case "private":  return { bg: "rgba(229,72,77,0.10)",  fg: color.danger };
  }
}

function kindGlyph(kind: SynthSymbol["kind"]): string {
  switch (kind) {
    case "class":     return "◆";
    case "interface": return "◇";
    case "function":  return "ƒ";
    case "method":    return "m";
    case "variable":  return "v";
  }
}

function signatureFor(sym: SynthSymbol): string {
  const prefix = sym.visibility === "public" ? "public " : sym.visibility === "private" ? "private " : "";
  switch (sym.kind) {
    case "class":     return `${prefix}class ${sym.name}`;
    case "interface": return `${prefix}interface ${sym.name}`;
    case "variable":  return `${prefix}const ${sym.name}`;
    case "function":  return `${prefix}function ${sym.name}(input, options)`;
    case "method":    return `${prefix}${sym.name}(input, options)`;
  }
}

function SymbolCardViewImpl({ ctx }: Props): ReactElement | null {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const entity: Entity | null = useMemo(() => {
    if (!ctx.tree) return null;
    const id = ctx.selectedId;
    if (!id) return null;
    return ctx.tree.byId.get(id) ?? null;
  }, [ctx.tree, ctx.selectedId]);

  const symbols = useMemo<SynthSymbol[]>(() => {
    if (!entity) return [];
    return symbolsInFile(entity);
  }, [entity]);

  const [focusedSymbolId, setFocusedSymbolId] = useState<string | null>(null);

  const focused = useMemo<SynthSymbol | null>(() => {
    if (symbols.length === 0) return null;
    const match = symbols.find(s => s.id === focusedSymbolId);
    if (match) return match;
    return symbols.slice().sort((a, b) => b.cyclomatic - a.cyclomatic)[0] ?? null;
  }, [symbols, focusedSymbolId]);

  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <EmptyFrame width={width} height={height} message="파일을 선택하면 심볼 뷰가 나타납니다." />;
  }
  if (symbols.length === 0 || !focused) {
    return <EmptyFrame width={width} height={height} message="이 파일에 추출 가능한 심볼이 없습니다." />;
  }

  const tests = testsForSymbol(focused.id, focused.tests);
  const body  = buildBody(focused);
  const vis   = visibilityTint(focused.visibility);

  return (
    <div style={{
      width, height,
      background: color.bg0,
      fontFamily: font.sans,
      color: color.text0,
      overflow: "auto",
      boxSizing: "border-box",
    }}>
      <style>{KEYFRAMES}</style>
      <div style={rootStyle}>
        {/* Header line */}
        <div style={headerRowStyle}>
          <span style={eyebrowStyle}>SYMBOL · {entity.name}</span>
          <span style={{ color: color.text3, fontSize: font.size.xxs }}>
            {symbols.length} 심볼 · peek definition
          </span>
        </div>

        {/* Symbol-selector strip */}
        <div style={chipStripStyle} role="tablist" aria-label="Symbols in file">
          {symbols.map((s, i) => {
            const active = s.id === focused.id;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFocusedSymbolId(s.id)}
                style={{
                  ...chipStyle,
                  background: active ? color.accentSoft : color.bg2,
                  border: `1px solid ${active ? color.accentBorder : color.border}`,
                  color: active ? color.accent : color.text1,
                  animation: `sc-rise ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                  animationDelay: `${Math.min(i * STAGGER_MS, 420)}ms`,
                }}
              >
                <span style={{ fontFamily: font.mono, opacity: 0.75 }}>{kindGlyph(s.kind)}</span>
                <span style={{ fontFamily: font.mono, fontWeight: font.weight.medium }}>{s.name}</span>
              </button>
            );
          })}
        </div>

        {/* Signature */}
        <div style={{
          ...signatureStyle,
          animation: `sc-rise ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: "80ms",
        }}>
          <span style={{ color: color.text3 }}>{kindGlyph(focused.kind)}</span>
          <span>{signatureFor(focused)}</span>
        </div>

        {/* Mini-stats row */}
        <div style={{
          ...statsRowStyle,
          animation: `sc-rise ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: "140ms",
        }}>
          <Stat label="LoC"  value={String(focused.loc)} />
          <Stat label="CC"   value={String(focused.cyclomatic)} />
          <Stat label="CogC" value={String(focused.cognitive)} />
          <span style={{ ...pillStyle, background: vis.bg, color: vis.fg }}>
            {focused.visibility}
          </span>
          <Stat label="called by" value={String(focused.callers)} />
          <Stat label="calls"     value={String(focused.callees)} />
          <Stat label="tests"     value={String(focused.tests)} />
        </div>

        {/* Two-column body */}
        <div style={bodyGridStyle}>
          {/* Definition preview */}
          <section style={{
            ...cardStyle,
            animation: `sc-rise ${ENTRY_MS}ms ${ENTRY_EASE} both`,
            animationDelay: "200ms",
          }}>
            <header style={cardHeaderStyle}>
              <span style={cardTitleStyle}>Definition preview</span>
              <span style={cardMetaStyle}>line {focused.line}</span>
            </header>
            <pre style={bodyCodeStyle}>
              <code>
                <span style={bodyLineDim}>{signatureFor(focused)} {"{"}</span>
                {body.map((line, i) => (
                  <span key={i} style={bodyLineStyle}>
                    <span style={lineGutterStyle}>{String(focused.line + i + 1).padStart(3, " ")}</span>
                    <span>{line}</span>
                  </span>
                ))}
                <span style={bodyLineDim}>{"}"}</span>
              </code>
            </pre>
          </section>

          {/* Tests panel */}
          <aside style={{
            ...cardStyle,
            animation: `sc-rise ${ENTRY_MS}ms ${ENTRY_EASE} both`,
            animationDelay: "260ms",
          }}>
            <header style={cardHeaderStyle}>
              <span style={cardTitleStyle}>Tests</span>
              <span style={cardMetaStyle}>{tests.length}</span>
            </header>
            {tests.length === 0 ? (
              <div style={emptyInlineStyle}>
                연결된 테스트가 없습니다.
              </div>
            ) : (
              <ul style={testListStyle}>
                {tests.map((t, i) => (
                  <li
                    key={`${t}-${i}`}
                    style={{
                      ...testItemStyle,
                      animation: `sc-rise ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                      animationDelay: `${280 + Math.min(i * 14, 280)}ms`,
                    }}
                  >
                    <span style={testDotStyle(hashId(`${focused.id}:${i}`))} />
                    <span style={{ fontFamily: font.mono, fontSize: font.size.xs }}>{t}</span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <span style={statStyle}>
      <span style={{ color: color.text2, fontSize: font.size.xxs, letterSpacing: font.letter.wide, textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ color: color.text0, fontSize: font.size.md, fontWeight: font.weight.semibold, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </span>
  );
}

function EmptyFrame({ width, height, message }: { width: number; height: number; message: string }): ReactElement {
  return (
    <div style={{
      width, height,
      background: color.bg0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: color.text3,
      fontFamily: font.sans,
      fontSize: font.size.md,
    }}>
      <style>{KEYFRAMES}</style>
      <div style={{ animation: `sc-enter ${ENTRY_MS}ms ${ENTRY_EASE} both` }}>{message}</div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const rootStyle: CSSProperties = {
  padding: `${space[6]}px ${space[7]}px ${space[7]}px`,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: space[4],
  animation: `sc-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  transformOrigin: "center top",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
};

const eyebrowStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
};

const chipStripStyle: CSSProperties = {
  display: "flex",
  gap: space[2],
  overflowX: "auto",
  paddingBottom: space[2],
  scrollbarWidth: "thin",
};

const chipStyle: CSSProperties = {
  flex: "0 0 auto",
  display: "inline-flex",
  alignItems: "center",
  gap: space[1],
  padding: `${space[1]}px ${space[3]}px`,
  borderRadius: radius.pill,
  fontSize: font.size.xs,
  cursor: "pointer",
  transition: "background 180ms ease-out, border-color 180ms ease-out, color 180ms ease-out",
  whiteSpace: "nowrap",
};

const signatureStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  fontFamily: font.mono,
  fontSize: font.size.xl,
  fontWeight: font.weight.medium,
  color: color.text0,
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const statsRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: space[4],
  alignItems: "center",
};

const statStyle: CSSProperties = {
  display: "inline-flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 52,
};

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: `${space[1]}px ${space[2]}px`,
  borderRadius: radius.pill,
  fontSize: font.size.xxs,
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
};

const bodyGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(360px, 1fr) minmax(220px, 320px)",
  gap: space[4],
  marginTop: space[2],
};

const cardStyle: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  padding: space[4],
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: space[3],
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  paddingBottom: space[2],
  borderBottom: `1px solid ${color.borderSoft}`,
};

const cardTitleStyle: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
};

const cardMetaStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  fontVariantNumeric: "tabular-nums",
};

const bodyCodeStyle: CSSProperties = {
  margin: 0,
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  borderRadius: radius.md,
  fontFamily: font.mono,
  fontSize: font.size.xs,
  lineHeight: 1.6,
  color: color.text0,
  display: "flex",
  flexDirection: "column",
  overflowX: "auto",
};

const bodyLineStyle: CSSProperties = {
  display: "flex",
  gap: space[3],
  whiteSpace: "pre",
};

const bodyLineDim: CSSProperties = {
  color: color.text2,
};

const lineGutterStyle: CSSProperties = {
  color: color.text3,
  userSelect: "none",
  fontVariantNumeric: "tabular-nums",
};

const testListStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: space[1],
  maxHeight: 320,
  overflowY: "auto",
};

const testItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[1]}px ${space[2]}px`,
  borderRadius: radius.sm,
  color: color.text1,
};

function testDotStyle(seed: number): CSSProperties {
  // Stable green/amber/accent tint so each row has a tiny identifier dot.
  const palette = [color.success, color.accent, "#8dd6a8"];
  const bg = palette[seed % palette.length]!;
  return {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    background: bg,
    flex: "0 0 auto",
  };
}

const emptyInlineStyle: CSSProperties = {
  color: color.text3,
  fontSize: font.size.sm,
  padding: space[3],
  textAlign: "center",
};

export const SymbolCardView = memo(SymbolCardViewImpl);
