// SbomView — SPDX / CycloneDX recursive package manifest.
// --------------------------------------------------------------------
// Top: 4 summary tiles (total packages, signed %, verified provenance
// %, with-CVE count). Body: indented tree — root → top-level deps →
// transitive children (2 levels deep). Each node shows name + version
// + license + sigstore signing checkmark + provenance badge + CVE
// count.
//
// Export button is a stub — real SPDX / CycloneDX emission happens in
// the static-analyzer pipeline, not the IDE.

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  synthSbom,
  type SbomNode,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;
const COUNTER_MS = 640;

const KEYFRAMES = `
@keyframes sbom-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes sbom-row   { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes sbom-toast { 0% { opacity: 0; transform: translateY(6px); } 10% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-4px); } }
`;

const PROVENANCE_TINT: Record<SbomNode["provenance"], string> = {
  verified: color.success,
  unknown:  color.warn,
  missing:  color.danger,
};
const PROVENANCE_LABEL: Record<SbomNode["provenance"], string> = {
  verified: "verified",
  unknown:  "unknown",
  missing:  "missing",
};

interface FlatRow {
  node: SbomNode;
  depth: number;
  key: string;
  isLast: boolean;
}

/** Depth-first flatten, depth 0 = root, 1 = top-level, 2 = transitive. */
function flatten(root: SbomNode): FlatRow[] {
  const out: FlatRow[] = [];
  const walk = (node: SbomNode, depth: number, keyPrefix: string, isLast: boolean): void => {
    out.push({ node, depth, key: keyPrefix, isLast });
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (!child) continue;
      walk(child, depth + 1, `${keyPrefix}/${i}:${child.name}`, i === node.children.length - 1);
    }
  };
  walk(root, 0, `0:${root.name}`, true);
  return out;
}

/** rAF counter 0 → target (ease-out cubic). */
function useCounter(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function SbomViewImpl({ ctx }: Props): ReactElement | null {
  const rootId = ctx.tree?.rootId ?? null;
  const [toast, setToast] = useState<string | null>(null);

  const sbom = useMemo(() => synthSbom(rootId), [rootId]);
  const rows = useMemo(() => flatten(sbom), [sbom]);

  const summary = useMemo(() => {
    // Count packages excluding the synthetic root node.
    let total = 0;
    let signed = 0;
    let verified = 0;
    let withCve = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const n = row.node;
      total++;
      if (n.signed) signed++;
      if (n.provenance === "verified") verified++;
      if (n.cve > 0) withCve++;
    }
    return {
      total,
      signedPct: total === 0 ? 0 : (signed / total) * 100,
      verifiedPct: total === 0 ? 0 : (verified / total) * 100,
      withCve,
    };
  }, [rows]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (rows.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={{ textAlign: "center", color: color.text3, fontSize: font.size.sm }}>
          SBOM 데이터가 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.xxl, fontWeight: font.weight.bold, color: color.text0, letterSpacing: font.letter.tight }}>
            Software Bill of Materials
          </div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            SPDX 2.3 · CycloneDX · Sigstore · CISA EO 14028
          </div>
        </div>
        <button
          type="button"
          onClick={() => setToast("Export as SPDX / CycloneDX (예정)")}
          style={exportButton}
        >
          ⬇ Export
        </button>
      </header>

      <div style={summaryGrid}>
        <SummaryTile label="total packages"     value={summary.total}       format={v => Math.round(v).toString()} suffix=""     tint={color.text0}   index={0} />
        <SummaryTile label="signed"             value={summary.signedPct}   format={v => v.toFixed(0)}              suffix="%"    tint={summary.signedPct >= 70 ? color.success : color.warn}   index={1} />
        <SummaryTile label="verified provenance" value={summary.verifiedPct} format={v => v.toFixed(0)}             suffix="%"    tint={summary.verifiedPct >= 50 ? color.success : color.warn} index={2} />
        <SummaryTile label="with CVE"           value={summary.withCve}     format={v => Math.round(v).toString()}  suffix=""     tint={summary.withCve > 0 ? color.danger : color.success}      index={3} />
      </div>

      <div style={treeStyle}>
        {rows.map((row, i) => (
          <SbomRow key={row.key} row={row} index={i} />
        ))}
      </div>

      {toast && (
        <div style={toastStyle} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label, value, suffix, tint, index, format,
}: {
  label: string;
  value: number;
  suffix: string;
  tint: string;
  index: number;
  format: (v: number) => string;
}): ReactElement {
  const anim = useCounter(value, COUNTER_MS);
  return (
    <div style={{ ...summaryTileStyle, animationDelay: `${index * STAGGER_MS}ms` }}>
      <div style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", fontWeight: font.weight.semibold }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: space[1], marginTop: 4 }}>
        <span style={{
          fontSize: 30, fontFamily: font.mono, fontWeight: font.weight.bold,
          color: tint, lineHeight: 1, fontVariantNumeric: "tabular-nums",
        }}>
          {format(anim)}
        </span>
        {suffix && <span style={{ fontSize: font.size.xs, color: color.text2 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function SbomRow({ row, index }: { row: FlatRow; index: number }): ReactElement {
  const n = row.node;
  const isRoot = row.depth === 0;
  const indent = row.depth * 20;
  const provenanceTint = PROVENANCE_TINT[n.provenance];

  return (
    <div
      style={{
        ...rowStyle,
        paddingLeft: space[4] + indent,
        animationDelay: `${Math.min(index, 40) * STAGGER_MS}ms`,
        background: isRoot ? color.bg2 : "transparent",
      }}
    >
      {/* Tree guide (visual only) */}
      {row.depth > 0 && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: space[4] + (row.depth - 1) * 20 + 6,
            top: 0,
            bottom: 0,
            width: 1,
            background: color.border,
          }}
        />
      )}
      {row.depth > 0 && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: space[4] + (row.depth - 1) * 20 + 6,
            top: "50%",
            width: 10,
            height: 1,
            background: color.border,
          }}
        />
      )}

      <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", alignItems: "center", gap: space[2] }}>
        <span style={{
          fontSize: font.size.sm,
          fontFamily: font.mono,
          color: isRoot ? color.text0 : color.text1,
          fontWeight: isRoot ? font.weight.bold : font.weight.semibold,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {n.name}
        </span>
        <span style={{ fontSize: font.size.xxs, fontFamily: font.mono, color: color.text2 }}>
          {n.version}
        </span>
      </div>

      <span style={{
        flex: "0 0 auto",
        padding: `${space[0]}px ${space[2]}px`,
        borderRadius: radius.sm,
        border: `1px solid ${color.border}`,
        background: color.bg2,
        color: color.text1,
        fontSize: 10,
        fontFamily: font.mono,
        minWidth: 84, textAlign: "center",
      }}>
        {n.license}
      </span>

      <span
        title={n.signed ? "Sigstore signed" : "unsigned"}
        style={{
          flex: "0 0 auto",
          width: 20, height: 20,
          borderRadius: "50%",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: n.signed ? `${color.success}1a` : "transparent",
          color: n.signed ? color.success : color.text3,
          border: n.signed ? `1px solid ${color.success}40` : `1px dashed ${color.border}`,
          fontSize: 10,
          fontWeight: font.weight.bold,
        }}
      >
        {n.signed ? "✓" : "–"}
      </span>

      <span style={{
        flex: "0 0 auto",
        padding: `${space[0]}px ${space[2]}px`,
        borderRadius: radius.pill,
        background: `${provenanceTint}18`,
        color: provenanceTint,
        border: `1px solid ${provenanceTint}40`,
        fontSize: 10,
        fontFamily: font.mono,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        fontWeight: font.weight.semibold,
        minWidth: 88, textAlign: "center",
      }}>
        {PROVENANCE_LABEL[n.provenance]}
      </span>

      <span style={{
        flex: "0 0 auto",
        minWidth: 64,
        display: "inline-flex", justifyContent: "flex-end", alignItems: "center", gap: 4,
        fontSize: font.size.xxs,
        fontFamily: font.mono,
        color: n.cve > 0 ? color.danger : color.text3,
      }}>
        {n.cve > 0 ? (
          <>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: color.danger }} />
            <span>CVE × {n.cve}</span>
          </>
        ) : (
          <span style={{ color: color.text3 }}>no CVE</span>
        )}
      </span>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `sbom-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  marginBottom: space[4],
};

const exportButton: CSSProperties = {
  padding: `${space[2]}px ${space[4]}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.bg1,
  color: color.text0,
  fontFamily: font.sans,
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  cursor: "pointer",
  transition: `all ${transition.base}`,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: space[3],
  marginBottom: space[4],
};

const summaryTileStyle: CSSProperties = {
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: `sbom-row ${ENTRY_MS}ms ${ENTRY_EASE} both`,
};

const treeStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const rowStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  borderBottom: `1px solid ${color.border}`,
  animation: `sbom-row ${ENTRY_MS}ms ${ENTRY_EASE} both`,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

const toastStyle: CSSProperties = {
  position: "fixed",
  right: space[7],
  bottom: space[7],
  padding: `${space[3]}px ${space[4]}px`,
  background: color.text0,
  color: "#ffffff",
  fontSize: font.size.xs,
  fontWeight: font.weight.medium,
  borderRadius: radius.md,
  boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
  animation: `sbom-toast 2400ms ease both`,
  pointerEvents: "none",
  zIndex: 10,
};

export const SbomView = memo(SbomViewImpl);
