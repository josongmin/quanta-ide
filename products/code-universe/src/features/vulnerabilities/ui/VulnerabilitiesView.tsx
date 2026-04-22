// VulnerabilitiesView — SAST findings panel with severity buckets.
// Top: 4 severity counters + review completion %.
// Middle: filterable finding list (CVE id, title, file, line, rule, status).

import { memo, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  securityRating,
  synthVulnerabilities,
  type Vulnerability,
  type VulnSeverity,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const SEVERITY_ORDER: VulnSeverity[] = ["critical", "high", "medium", "low"];

const SEVERITY_TINT: Record<VulnSeverity, string> = {
  critical: color.danger,
  high:     color.warn,
  medium:   "#d97706", // mid amber — no token between warn and warn-soft
  low:      color.text2,
};

const SEVERITY_LABEL: Record<VulnSeverity, string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
};

const KEYFRAMES = `
@keyframes vuln-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes vuln-count { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
`;

type FilterSev = "all" | VulnSeverity;
type FilterStatus = "all" | "open" | "reviewed";

function collect(ctx: ViewContextValue): { all: Vulnerability[]; fileById: Map<string, string> } {
  const all: Vulnerability[] = [];
  const fileById = new Map<string, string>();
  if (!ctx.tree) return { all, fileById };
  for (const entity of ctx.tree.byId.values()) {
    if (entity.kind !== "building") continue;
    fileById.set(entity.id, entity.name);
    for (const v of synthVulnerabilities(entity)) all.push(v);
  }
  all.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  return { all, fileById };
}

function VulnerabilitiesViewImpl({ ctx }: Props): ReactElement | null {
  const { all, fileById } = useMemo(() => collect(ctx), [ctx]);
  const [sevFilter, setSevFilter] = useState<FilterSev>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const counts = useMemo(() => {
    const c: Record<VulnSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const v of all) c[v.severity]++;
    return c;
  }, [all]);

  const reviewCompletion = useMemo(() => {
    if (all.length === 0) return 1;
    const reviewed = all.filter(v => v.reviewed).length;
    return reviewed / all.length;
  }, [all]);

  const rating = securityRating(counts);

  const filtered = useMemo(() => {
    return all.filter(v => {
      if (sevFilter !== "all" && v.severity !== sevFilter) return false;
      if (statusFilter === "open" && v.reviewed) return false;
      if (statusFilter === "reviewed" && !v.reviewed) return false;
      return true;
    });
  }, [all, sevFilter, statusFilter]);

  if (all.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: font.size.xxl, color: color.success, fontWeight: font.weight.semibold }}>✓ 취약점 없음</div>
          <div style={{ marginTop: space[2], fontSize: font.size.sm, color: color.text2 }}>Security Rating <strong style={{ color: color.success }}>A</strong> · 모든 조건 통과</div>
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>Vulnerabilities</div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            총 {all.length}건 · 리뷰 완료 {Math.round(reviewCompletion * 100)}%
          </div>
        </div>
        <div style={ratingBadge(rating)}>
          <span style={{ fontSize: font.size.xxs, letterSpacing: font.letter.ultra, color: color.text2 }}>SECURITY</span>
          <span style={{ fontSize: 28, fontFamily: font.mono, fontWeight: font.weight.bold, color: ratingColor(rating), lineHeight: 1 }}>{rating}</span>
        </div>
      </header>

      <div style={sevGrid}>
        {SEVERITY_ORDER.map((sev, i) => (
          <SevTile key={sev} sev={sev} count={counts[sev]} index={i} />
        ))}
      </div>

      <div style={filterRow}>
        <FilterChip label="전체" active={sevFilter === "all"} onClick={() => setSevFilter("all")} />
        {SEVERITY_ORDER.map(s => (
          <FilterChip key={s} label={`${SEVERITY_LABEL[s]} · ${counts[s]}`} active={sevFilter === s} tint={SEVERITY_TINT[s]} onClick={() => setSevFilter(s)} />
        ))}
        <span style={{ flex: 1 }} />
        <FilterChip label="모두" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <FilterChip label="미검토" active={statusFilter === "open"} onClick={() => setStatusFilter("open")} />
        <FilterChip label="검토완료" active={statusFilter === "reviewed"} onClick={() => setStatusFilter("reviewed")} />
      </div>

      <div style={listStyle}>
        {filtered.length === 0 ? (
          <div style={{ padding: space[4], color: color.text3, fontSize: font.size.sm, textAlign: "center" }}>
            조건에 맞는 취약점이 없습니다.
          </div>
        ) : filtered.map((v, i) => (
          <FindingRow key={v.fileId + v.id} v={v} index={i} fileName={fileById.get(v.fileId)} onFocus={() => ctx.dispatch.selectEntity(v.fileId)} />
        ))}
      </div>
    </div>
  );
}

function ratingColor(r: "A" | "B" | "C" | "D" | "E"): string {
  if (r === "A") return color.success;
  if (r === "B") return "#7db843";
  if (r === "C") return color.warn;
  if (r === "D") return "#e06a21";
  return color.danger;
}

function ratingBadge(_r: "A" | "B" | "C" | "D" | "E"): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    padding: `${space[2]}px ${space[4]}px`,
    background: color.bg1,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
  };
}

function SevTile({ sev, count, index }: { sev: VulnSeverity; count: number; index: number }) {
  const tint = SEVERITY_TINT[sev];
  return (
    <div style={{
      ...tileStyle,
      animationDelay: `${index * 40}ms`,
    }}>
      <span style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", fontWeight: font.weight.semibold }}>{SEVERITY_LABEL[sev]}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: space[1], marginTop: 2 }}>
        <span style={{
          fontSize: 30, fontFamily: font.mono, fontWeight: font.weight.bold,
          color: count > 0 ? tint : color.text3,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}>
          {count}
        </span>
        {count > 0 && (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: tint, marginLeft: 2 }} />
        )}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick, tint }: { label: string; active: boolean; onClick: () => void; tint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: `${space[1]}px ${space[3]}px`,
        border: `1px solid ${active ? (tint ?? color.accent) : color.border}`,
        background: active ? (tint ? `${tint}18` : color.accentSofter) : color.bg1,
        color: active ? (tint ?? color.accent) : color.text1,
        fontFamily: font.sans,
        fontSize: font.size.xs,
        fontWeight: font.weight.medium,
        borderRadius: radius.pill,
        cursor: "pointer",
        transition: `all ${transition.base}`,
      }}
    >
      {label}
    </button>
  );
}

function FindingRow({ v, index, fileName, onFocus }: { v: Vulnerability; index: number; fileName: string | undefined; onFocus: () => void }) {
  const tint = SEVERITY_TINT[v.severity];
  return (
    <button
      type="button"
      onClick={onFocus}
      style={{
        ...rowStyle,
        animationDelay: `${Math.min(index, 40) * 14}ms`,
      }}
    >
      <span style={{
        padding: `${space[1]}px ${space[2]}px`,
        borderRadius: radius.sm,
        background: `${tint}18`,
        color: tint,
        fontFamily: font.mono,
        fontSize: 10,
        fontWeight: font.weight.semibold,
        flexShrink: 0,
        minWidth: 64,
        textAlign: "center",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}>
        {SEVERITY_LABEL[v.severity]}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: font.size.sm, color: color.text0, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {v.title}
        </span>
        <span style={{ fontSize: font.size.xxs, color: color.text2, fontFamily: font.mono, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {v.id} · {v.rule} · <span style={{ color: color.text1 }}>{fileName ?? v.fileId}</span>:{v.line}
        </span>
      </span>
      <span style={{
        padding: `2px ${space[2]}px`,
        borderRadius: radius.pill,
        background: v.reviewed ? color.accentSofter : "transparent",
        border: v.reviewed ? `1px solid transparent` : `1px dashed ${color.border}`,
        color: v.reviewed ? color.success : color.text3,
        fontSize: font.size.xxs,
        fontWeight: font.weight.medium,
        flexShrink: 0,
      }}>
        {v.reviewed ? "검토완료" : "미검토"}
      </span>
    </button>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: "vuln-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: space[4],
};

const sevGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: space[3],
  marginBottom: space[4],
};

const tileStyle: CSSProperties = {
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: "vuln-count 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const filterRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  marginBottom: space[3],
  flexWrap: "wrap",
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${color.border}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: "vuln-enter 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const VulnerabilitiesView = memo(VulnerabilitiesViewImpl);
