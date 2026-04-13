import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import type { FileInspectorData, FileSymbol, FileSignal, HeatRow, BlastNeighbor } from "@/app/ide/mock-file-inspector";
import { useInspectorContext } from "../model/useInspectorContext";

/* ── helpers ── */
function riskColor(score: number) {
  if (score >= 40) return "var(--accent)";
  if (score > 0)   return "var(--ink-2)";
  return "var(--ink-4)";
}

function RiskBadge({ score }: { score: number }) {
  const c = riskColor(score);
  if (score === 0) return null;
  return <span className="fii-risk" style={{ color: c, borderColor: c }}>{score}</span>;
}

function FiiSection({ label, count, children }: { label: string; count?: number; children: ReactNode }) {
  return (
    <div className="fii-section">
      <div className="fii-section-header">
        <span className="fii-section-label">{label}</span>
        {count !== undefined && <span className="fii-section-count">{count}</span>}
      </div>
      {children}
    </div>
  );
}

/* ── 1. Risk Signals ── */
const SIGNAL_ICONS: Record<FileSignal["kind"], string> = {
  "no-tests":    "⊘",
  "taint-sink":  "⬇",
  "taint-source":"⬆",
  "dead-code":   "◌",
  "bus-factor":  "⚑",
  "high-cpx":    "≋",
  "blast":       "◎",
};
const SIGNAL_SEV_CLASS: Record<FileSignal["severity"], string> = {
  3: "is-crit",
  2: "is-warn",
  1: "is-info",
};

function SignalList({ signals }: { signals: FileSignal[] }) {
  if (signals.length === 0) return null;
  return (
    <div className="fii-signals">
      {signals.map((s, i) => (
        <div key={i} className={`fii-signal ${SIGNAL_SEV_CLASS[s.severity]}`}>
          <span className="fii-signal-icon">{SIGNAL_ICONS[s.kind]}</span>
          <span className="fii-signal-msg">{s.message}</span>
          {s.symbol && <span className="fii-signal-sym">{s.symbol}</span>}
        </div>
      ))}
    </div>
  );
}

/* ── 2. Function Heatmap ── */
function HeatMap({ rows }: { rows: HeatRow[] }) {
  const maxRisk = Math.max(...rows.map((r) => r.risk), 1);
  return (
    <div className="fii-heat">
      {rows.map((row) => {
        const pct = Math.round((row.risk / maxRisk) * 100);
        return (
          <div key={row.name} className={`fii-heat-row${row.dead ? " is-dead" : ""}`}>
            <span className="fii-heat-loc">:{row.loc}</span>
            <span className="fii-heat-name">{row.name}</span>
            <div className="fii-heat-bar-wrap">
              <div
                className="fii-heat-bar"
                style={{ width: `${pct}%`, background: row.dead ? "var(--ink-4)" : "var(--accent)" }}
              />
            </div>
            {!row.dead && <span className="fii-heat-cpx" style={{ color: "var(--ink-3)" }}>
              {row.cpx.toFixed(1)}
            </span>}
            {row.dead && <span className="fii-heat-dead">dead</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ── 3. Stats Grid ── */
function StatGrid({ blast, taint, dead, bus }: { blast: number; taint: number; dead: number; bus: number }) {
  return (
    <div className="fii-stats">
      <div className="fii-stat">
        <span className="fii-stat-label">BLAST</span>
        <span className="fii-stat-value">{blast}</span>
      </div>
      <div className="fii-stat">
        <span className="fii-stat-label">TAINT</span>
        <span className="fii-stat-value" style={{ color: taint > 0 ? "var(--accent)" : "var(--ink-3)" }}>{taint}</span>
      </div>
      <div className="fii-stat">
        <span className="fii-stat-label">DEAD</span>
        <span className="fii-stat-value" style={{ color: dead > 0 ? "var(--ink-2)" : "var(--ink-3)" }}>{dead}</span>
      </div>
      <div className="fii-stat">
        <span className="fii-stat-label">BUS</span>
        <span className="fii-stat-value" style={{ color: bus === 1 ? "var(--accent)" : "var(--ink-2)" }}>{bus}</span>
      </div>
    </div>
  );
}

/* ── 4. Ownership ── */
function OwnerRow({ name, coverage }: { name: string; coverage: number }) {
  return (
    <div className="fii-owner-row">
      <span className="fii-owner-avatar">{name[0].toUpperCase()}</span>
      <span className="fii-owner-name">{name}</span>
      <div className="fii-owner-bar">
        <div className="fii-owner-fill" style={{ width: `${coverage}%` }} />
      </div>
      <span className="fii-owner-pct">{coverage}%</span>
    </div>
  );
}

/* ── 5. Symbol List ── */
function SymbolRow({ sym, fileName }: { sym: FileSymbol; fileName: string }) {
  const { setSymbolContext } = useInspectorContext();

  const handleClick = () => {
    if (sym.kind === "function" || sym.kind === "class") {
      setSymbolContext({
        name: sym.name,
        kind: "function",
        taint: sym.taint,
        callers: sym.callers,
        complexity: sym.cpx ? parseFloat(sym.cpx) : undefined,
        fileName,
      });
    }
  };

  const isClickable = sym.kind === "function" || sym.kind === "class";
  const kindGlyph = sym.kind === "function" ? "ƒ" : sym.kind === "class" ? "C" : sym.kind === "const" ? "K" : "T";

  return (
    <button
      type="button"
      className={`fii-sym-row${sym.dead ? " is-dead" : ""}${isClickable ? " is-clickable" : ""}`}
      onClick={isClickable ? handleClick : undefined}
    >
      <span className="fii-sym-kind" data-kind={sym.kind}>{kindGlyph}</span>
      <span className="fii-sym-name">{sym.name}</span>
      <span className="fii-sym-loc">:{sym.loc}</span>
      {sym.dead && <span className="fii-sym-dead">dead</span>}
      {sym.taint && <span className={`fii-sym-taint fii-sym-taint-${sym.taint}`}>{sym.taint}</span>}
      {sym.callers !== undefined && sym.callers > 0 && (
        <span className="fii-sym-callers">{sym.callers}↑</span>
      )}
      <RiskBadge score={sym.riskScore} />
      {isClickable && (
        <svg className="fii-sym-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </button>
  );
}

/* ── 6. Blast Neighbors ── */
function NeighborRow({ n, onNavigate }: { n: BlastNeighbor; onNavigate: (name: string) => void }) {
  const rc = riskColor(n.risk);
  const isImporter = n.relation === "imports-us";
  return (
    <button
      type="button"
      className="fii-neighbor-row"
      onClick={() => { onNavigate(n.name); }}
    >
      <span className="fii-neighbor-rel" title={isImporter ? "imports this file" : "imported by this file"}>
        {isImporter ? "←" : "→"}
      </span>
      <span className="fii-neighbor-name">{n.name}</span>
      <span className="fii-neighbor-risk" style={{ color: rc, borderColor: rc }}>
        <span className="fii-neighbor-dot" style={{ background: rc }} />
        {n.risk}
      </span>
    </button>
  );
}

/* ── Main export ── */
export interface FileInspectorProps {
  data: FileInspectorData;
  onNavigate?: (name: string) => void;
  /** Extra injected content (e.g. BlastRadiusViz section) */
  children?: ReactNode;
}

export function FileInspector({ data, onNavigate, children }: FileInspectorProps) {
  const { t } = useTranslation();
  const rc = riskColor(data.riskScore);

  return (
    <div className="fii-root">

      {/* ── File Header ── */}
      <div className="fii-head">
        <div className="fii-head-row">
          <span className="fii-risk-badge" style={{ color: rc, borderColor: rc }}>
            <span className="fii-risk-dot" style={{ background: rc }} />
            RISK {data.riskScore}
          </span>
        </div>
        <div className="fii-meta-row">
          <span className="fii-meta">{data.loc} lines</span>
          <span className="fii-meta-sep">·</span>
          <span className="fii-meta">{data.functions} {t("ide.fileInspector.functions")}</span>
          <span className="fii-meta-sep">·</span>
          <span className="fii-meta">{data.lastModified}</span>
        </div>
      </div>

      {/* ── 1. Risk Signals ── */}
      {data.signals.length > 0 && (
        <FiiSection label={t("ide.fileInspector.signals")} count={data.signals.filter(s => s.severity >= 2).length || undefined}>
          <SignalList signals={data.signals} />
        </FiiSection>
      )}

      {/* ── 2. Function Heatmap ── */}
      <FiiSection label={t("ide.fileInspector.heatmap")}>
        <HeatMap rows={data.heatRows} />
      </FiiSection>

      {/* ── 3. Stats ── */}
      <StatGrid
        blast={data.blastTotal}
        taint={data.taintPaths}
        dead={data.deadCode}
        bus={data.busFactor}
      />

      {/* ── 4. Connected Files ── */}
      {data.blastNeighbors.length > 0 && (
        <FiiSection label={t("ide.fileInspector.connected")}>
          <div className="fii-neighbors">
            {data.blastNeighbors.map((n) => (
              <NeighborRow key={n.name} n={n} onNavigate={onNavigate ?? ((_name: string) => { /* no-op */ })} />
            ))}
          </div>
        </FiiSection>
      )}

      {/* ── 5. Ownership ── */}
      <FiiSection label={t("ide.fileInspector.ownership")}>
        <div className="fii-owners">
          {data.owners.map((o) => (
            <OwnerRow key={o.name} name={o.name} coverage={o.coverage} />
          ))}
        </div>
      </FiiSection>

      {/* ── 6. Symbols ── */}
      <FiiSection label={t("ide.fileInspector.symbols")} count={data.symbols.length}>
        <div className="fii-sym-list">
          {data.symbols.map((sym) => (
            <SymbolRow key={sym.name} sym={sym} fileName={data.fileName} />
          ))}
        </div>
      </FiiSection>

      {/* ── Injected (e.g. BlastRadiusViz) ── */}
      {children}
    </div>
  );
}
