import { useState, useCallback } from "react";
import { Section } from "@quanta/ui-kit/ui/section";
import { IconClass, IconFunction, IconChevron } from "@quanta/ui-kit/ui/icons";
import { riskColor } from "@quanta/ui-kit/lib/risk";
import type { SymbolFacts, SymbolKind } from "@quanta/app-ide/entities/symbol";
import type { FileFacts } from "@quanta/app-ide/entities/file";

/* ── Helpers ── */

function hasIssue(sym: SymbolFacts): boolean {
  return !!(
    sym.taint ||
    sym.dead ||
    (sym.riskScore && sym.riskScore >= 50) ||
    sym.incidentMatch ||
    (sym.tests && sym.tests.startsWith("0/"))
  );
}

function hasIssueDeep(sym: SymbolFacts): boolean {
  if (hasIssue(sym)) return true;
  return sym.children?.some(hasIssueDeep) ?? false;
}

function signalCount(sym: SymbolFacts): number {
  let n = 0;
  if (sym.taint) n++;
  if (sym.dead) n++;
  if (sym.tests && sym.tests.startsWith("0/")) n++;
  if (sym.incidentMatch) n++;
  if (sym.riskScore && sym.riskScore >= 50) n++;
  for (const c of sym.children ?? []) n += signalCount(c);
  return n;
}

const KIND_ICON: Record<SymbolKind, React.ReactNode> = {
  class: <IconClass size={12} />,
  function: <IconFunction size={12} />,
  method: <IconFunction size={12} />,
  variable: <span className="stree__kglyph">v</span>,
  parameter: <span className="stree__kglyph">p</span>,
  module: <span className="stree__kglyph">M</span>,
};

function taintDot(sym: SymbolFacts) {
  if (!sym.taint) return null;
  const cls =
    sym.taint === "sink" ? "stree__dot--sink" :
    sym.taint === "source" ? "stree__dot--source" :
    "stree__dot--through";
  return <span className={`stree__dot ${cls}`} />;
}

/* ── Node component ── */

function SymbolNode({
  sym,
  depth,
  isLast,
}: {
  sym: SymbolFacts;
  depth: number;
  isLast: boolean;
}) {
  const kids = sym.children ?? [];
  const expandable = kids.length > 0;
  const [open, setOpen] = useState(() => expandable && hasIssueDeep(sym));
  const flagged = hasIssue(sym);
  const signals = signalCount(sym);
  const risk = sym.riskScore;
  const color = risk != null && risk > 0 ? riskColor(risk) : undefined;

  const toggle = useCallback(() => {
    if (expandable) setOpen((o) => !o);
  }, [expandable]);

  return (
    <li className="stree__item">
      {/* tree guide: vertical line from parent */}
      {depth > 0 && (
        <span
          className={"stree__guide" + (isLast ? " stree__guide--last" : "")}
          style={{ left: `${depth * 16 + 3}px` }}
          aria-hidden
        />
      )}

      <div
        className={
          "stree__row" +
          (flagged ? " stree__row--flagged" : "") +
          (expandable ? " stree__row--expandable" : "")
        }
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={toggle}
        role={expandable ? "button" : undefined}
        tabIndex={expandable ? 0 : undefined}
        onKeyDown={expandable ? (e) => { if (e.key === "Enter" || e.key === " ") toggle(); } : undefined}
      >
        {/* chevron */}
        {expandable ? (
          <span className={"stree__chev" + (open ? " is-open" : "")}>
            <IconChevron size={10} />
          </span>
        ) : (
          <span className="stree__chev-spacer" />
        )}

        {/* taint dot */}
        {taintDot(sym)}

        {/* kind icon */}
        <span className="stree__icon">{KIND_ICON[sym.kind]}</span>

        {/* name + line */}
        <span className="stree__label">
          <span className="stree__name">{sym.name}</span>
          {sym.line > 0 && <span className="stree__ln">:{sym.line}</span>}
        </span>

        {/* right-side badges */}
        <span className="stree__trail">
          {sym.tests && sym.tests.startsWith("0/") && (
            <span className="stree__badge stree__badge--warn">{sym.tests}</span>
          )}
          {sym.dead && (
            <span className="stree__badge stree__badge--muted">dead</span>
          )}
          {sym.incidentMatch && (
            <span className="stree__badge stree__badge--danger">{sym.incidentMatch.id}</span>
          )}
          {expandable && !open && signals > 0 && (
            <span className="stree__signal-count">{signals}</span>
          )}
          {risk != null && risk > 0 && (
            <span className="stree__risk" style={{ color }}>{risk}</span>
          )}
        </span>
      </div>

      {/* detail subtitle */}
      {sym.detail && open && (
        <div
          className="stree__detail"
          style={{ paddingLeft: `${8 + depth * 16 + 14 + 14 + 6}px` }}
        >
          {sym.detail}
        </div>
      )}

      {/* children */}
      {expandable && open && (
        <ul className="stree__children">
          {kids.map((c, i) => (
            <SymbolNode
              key={`${c.kind}-${c.name}-${c.line}`}
              sym={c}
              depth={depth + 1}
              isLast={i === kids.length - 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ── Section ── */

function countAll(syms: SymbolFacts[]): number {
  let n = syms.length;
  for (const s of syms) if (s.children) n += countAll(s.children);
  return n;
}

export function FileSymbolsSection({ file }: { file: FileFacts }) {
  const symbols = file.symbols;
  if (symbols.length === 0) return null;

  return (
    <Section label="Symbols" count={countAll(symbols)}>
      <ul className="stree">
        {symbols.map((s, i) => (
          <SymbolNode
            key={`${s.kind}-${s.name}-${s.line}`}
            sym={s}
            depth={0}
            isLast={i === symbols.length - 1}
          />
        ))}
      </ul>
    </Section>
  );
}
