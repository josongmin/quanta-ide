// DependencyHealthView — supply-chain audit panel.
// --------------------------------------------------------------------
// Top: 4 summary tiles (outdated / vulnerable / license risk / total size).
// Middle: filter chips — update kind + vulnerability severity.
// Bottom: row list per top-level package with:
//   name · current→latest · update-kind badge · vuln count+severity ·
//   license tag · install-size bar · weekly-download sparkline.
//
// Reference: Dependabot · Snyk Open Source · Socket.dev.

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  hashId,
  mulberry32,
  synthDependencies,
  type DepRecord,
  type VulnSeverity,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;
const COUNTER_MS = 640;

const KEYFRAMES = `
@keyframes dh-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes dh-row   { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes dh-spark { from { stroke-dashoffset: var(--dh-spark-len); } to { stroke-dashoffset: 0; } }
`;

type UpdateFilter = "all" | "none" | "patch" | "minor" | "major";
type SevFilter    = "all" | VulnSeverity;

const UPDATE_ORDER: Array<DepRecord["updateKind"]> = ["none", "patch", "minor", "major"];
const UPDATE_TINT: Record<DepRecord["updateKind"], string> = {
  none:  color.text2,
  patch: color.success,
  minor: color.warn,
  major: color.danger,
};
const UPDATE_LABEL: Record<DepRecord["updateKind"], string> = {
  none:  "up-to-date",
  patch: "patch",
  minor: "minor",
  major: "major",
};

const SEVERITY_ORDER: VulnSeverity[] = ["critical", "high", "medium", "low"];
const SEVERITY_TINT: Record<VulnSeverity, string> = {
  critical: color.danger,
  high:     color.warn,
  medium:   "#d97706",
  low:      color.text2,
};
const SEVERITY_LABEL: Record<VulnSeverity, string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
};

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

/** Seeded 12-week weekly-download walk. */
function downloadSpark(name: string, baseline: number): number[] {
  const out: number[] = [];
  let prev = baseline;
  for (let w = 0; w < 12; w++) {
    const rng = mulberry32(hashId(`${name}:metric:${w}`));
    const drift = (rng() - 0.45) * baseline * 0.25;
    prev = Math.max(1, prev * 0.72 + baseline * 0.28 + drift);
    out.push(prev);
  }
  return out;
}

function formatSize(kb: number): string {
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

function DependencyHealthViewImpl({ ctx }: Props): ReactElement | null {
  const rootId = ctx.tree?.rootId ?? null;
  const [updateFilter, setUpdateFilter] = useState<UpdateFilter>("all");
  const [sevFilter, setSevFilter] = useState<SevFilter>("all");

  const deps = useMemo(() => synthDependencies(rootId), [rootId]);

  const summary = useMemo(() => {
    let outdated = 0;
    let vulnerable = 0;
    let licenseRisk = 0;
    let totalKb = 0;
    for (const d of deps) {
      if (d.updateKind !== "none") outdated++;
      if (d.vulns > 0) vulnerable++;
      if (!d.licenseOk) licenseRisk++;
      totalKb += d.sizeKb;
    }
    return { outdated, vulnerable, licenseRisk, totalKb, total: deps.length };
  }, [deps]);

  const filtered = useMemo(() => {
    return deps.filter(d => {
      if (updateFilter === "none"  && d.updateKind !== "none")  return false;
      if (updateFilter === "patch" && d.updateKind !== "patch") return false;
      if (updateFilter === "minor" && d.updateKind !== "minor") return false;
      if (updateFilter === "major" && d.updateKind !== "major") return false;
      if (sevFilter !== "all") {
        if (d.vulnSeverity !== sevFilter) return false;
      }
      return true;
    });
  }, [deps, updateFilter, sevFilter]);

  if (deps.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={{ textAlign: "center", color: color.text3, fontSize: font.size.sm }}>
          의존성 데이터가 없습니다.
        </div>
      </div>
    );
  }

  const maxSize = Math.max(...deps.map(d => d.sizeKb), 1);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.xxl, fontWeight: font.weight.bold, color: color.text0, letterSpacing: font.letter.tight }}>
            Dependency Health
          </div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            {summary.total} top-level · Dependabot · Snyk · Socket.dev
          </div>
        </div>
      </header>

      <div style={summaryGrid}>
        <SummaryTile label="outdated"     value={summary.outdated}     suffix={`/ ${summary.total}`} tint={summary.outdated > 0 ? color.warn : color.success} index={0} />
        <SummaryTile label="vulnerable"   value={summary.vulnerable}   suffix={`/ ${summary.total}`} tint={summary.vulnerable > 0 ? color.danger : color.success} index={1} />
        <SummaryTile label="license risk" value={summary.licenseRisk}  suffix={`/ ${summary.total}`} tint={summary.licenseRisk > 0 ? color.warn : color.success} index={2} />
        <SummaryTile label="total size"   value={summary.totalKb / 1024} suffix="MB" tint={color.text0} index={3} format={v => v.toFixed(1)} />
      </div>

      <div style={filterRow}>
        <span style={filterGroupLabel}>Update</span>
        <FilterChip label="all" active={updateFilter === "all"} onClick={() => setUpdateFilter("all")} />
        {UPDATE_ORDER.map(k => (
          <FilterChip
            key={k}
            label={UPDATE_LABEL[k]}
            active={updateFilter === k}
            tint={UPDATE_TINT[k]}
            onClick={() => setUpdateFilter(k)}
          />
        ))}
        <span style={{ flex: 1 }} />
        <span style={filterGroupLabel}>Severity</span>
        <FilterChip label="all" active={sevFilter === "all"} onClick={() => setSevFilter("all")} />
        {SEVERITY_ORDER.map(s => (
          <FilterChip
            key={s}
            label={SEVERITY_LABEL[s]}
            active={sevFilter === s}
            tint={SEVERITY_TINT[s]}
            onClick={() => setSevFilter(s)}
          />
        ))}
      </div>

      <div style={listStyle}>
        {filtered.length === 0 ? (
          <div style={{ padding: space[5], color: color.text3, fontSize: font.size.sm, textAlign: "center" }}>
            조건에 맞는 의존성이 없습니다.
          </div>
        ) : (
          filtered.map((d, i) => (
            <DepRow key={d.name} dep={d} index={i} maxSize={maxSize} />
          ))
        )}
      </div>
    </div>
  );
}

function SummaryTile({
  label, value, suffix, tint, index, format,
}: {
  label: string;
  value: number;
  suffix?: string;
  tint: string;
  index: number;
  format?: (v: number) => string;
}): ReactElement {
  const anim = useCounter(value, COUNTER_MS);
  const display = format ? format(anim) : Math.round(anim).toString();
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
          {display}
        </span>
        {suffix !== undefined && (
          <span style={{ fontSize: font.size.xs, color: color.text2 }}>{suffix}</span>
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

function DepRow({ dep, index, maxSize }: { dep: DepRecord; index: number; maxSize: number }) {
  const updateTint = UPDATE_TINT[dep.updateKind];
  const vulnTint = dep.vulnSeverity ? SEVERITY_TINT[dep.vulnSeverity] : color.text3;
  const spark = useMemo(() => downloadSpark(dep.name, dep.weeklyDownloads / 12), [dep.name, dep.weeklyDownloads]);
  const sparkMax = Math.max(...spark, 1);
  const sparkMin = Math.min(...spark);
  const range = Math.max(1e-6, sparkMax - sparkMin);
  const svgW = 88;
  const svgH = 28;
  const pts = spark.map((v, i) => {
    const x = (i / (spark.length - 1)) * svgW;
    const y = svgH - ((v - sparkMin) / range) * (svgH - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M ${pts.join(" L ")}`;
  const sparkLen = 300;
  const sparkDelay = index * STAGGER_MS + 220;
  const sizePct = Math.min(1, dep.sizeKb / maxSize);

  return (
    <div style={{ ...rowStyle, animationDelay: `${index * STAGGER_MS}ms` }}>
      <div style={{ flex: "0 0 168px", minWidth: 0 }}>
        <div style={{
          fontSize: font.size.sm, color: color.text0, fontFamily: font.mono,
          fontWeight: font.weight.semibold,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {dep.name}
        </div>
        <div style={{ fontSize: font.size.xxs, color: color.text2, marginTop: 2, fontFamily: font.mono }}>
          v{dep.current}
          {dep.updateKind !== "none" && (
            <>
              {" → "}
              <span style={{ color: updateTint, fontWeight: font.weight.semibold }}>{dep.latest}</span>
            </>
          )}
        </div>
      </div>

      <span style={{
        flex: "0 0 auto",
        padding: `${space[0]}px ${space[2]}px`,
        borderRadius: radius.sm,
        background: `${updateTint}18`,
        color: updateTint,
        fontSize: 10, fontFamily: font.mono, fontWeight: font.weight.semibold,
        minWidth: 72, textAlign: "center",
        textTransform: "uppercase", letterSpacing: "0.05em",
      }}>
        {UPDATE_LABEL[dep.updateKind]}
      </span>

      <span style={{
        flex: "0 0 auto",
        display: "inline-flex",
        alignItems: "center",
        gap: space[1],
        minWidth: 96,
      }}>
        {dep.vulns > 0 && dep.vulnSeverity ? (
          <>
            <span style={{
              padding: `${space[0]}px ${space[2]}px`,
              borderRadius: radius.sm,
              background: `${vulnTint}1a`,
              color: vulnTint,
              fontSize: 10, fontFamily: font.mono, fontWeight: font.weight.semibold,
              letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              {SEVERITY_LABEL[dep.vulnSeverity]}
            </span>
            <span style={{ fontSize: font.size.xxs, color: color.text2, fontFamily: font.mono }}>
              × {dep.vulns}
            </span>
          </>
        ) : (
          <span style={{ fontSize: font.size.xxs, color: color.success }}>● clean</span>
        )}
      </span>

      <span style={{
        flex: "0 0 auto",
        padding: `${space[0]}px ${space[2]}px`,
        borderRadius: radius.sm,
        border: `1px solid ${dep.licenseOk ? color.border : color.danger}40`,
        background: dep.licenseOk ? color.bg2 : `${color.danger}14`,
        color: dep.licenseOk ? color.text1 : color.danger,
        fontSize: 10, fontFamily: font.mono,
        minWidth: 88, textAlign: "center",
      }}>
        {dep.license}
      </span>

      <div style={{ flex: "1 1 140px", minWidth: 120 }}>
        <div style={sizeBarBase}>
          <div style={{
            ...sizeBarFill,
            width: `${sizePct * 100}%`,
            background: color.text0,
          }} />
        </div>
        <div style={{ fontSize: font.size.xxs, color: color.text2, marginTop: 3, fontFamily: font.mono }}>
          {formatSize(dep.sizeKb)} · {dep.transitiveCount} transitive
        </div>
      </div>

      <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <svg width={svgW} height={svgH} aria-hidden style={{ display: "block" }}>
          <path
            d={path}
            fill="none"
            stroke={color.accent}
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              ["--dh-spark-len" as string]: sparkLen,
              strokeDasharray: sparkLen,
              animation: `dh-spark 720ms ${ENTRY_EASE} ${sparkDelay}ms both`,
            } as CSSProperties}
          />
        </svg>
        <div style={{ fontSize: font.size.xxs, color: color.text2, marginTop: 2, fontFamily: font.mono }}>
          {formatDownloads(dep.weeklyDownloads)}/wk
        </div>
      </div>
    </div>
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
  animation: `dh-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  marginBottom: space[4],
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
  animation: `dh-row ${ENTRY_MS}ms ${ENTRY_EASE} both`,
};

const filterRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  marginBottom: space[3],
  flexWrap: "wrap",
};

const filterGroupLabel: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
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
  padding: `${space[3]}px ${space[4]}px`,
  borderBottom: `1px solid ${color.border}`,
  animation: `dh-row ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  transition: `background ${transition.base}`,
};

const sizeBarBase: CSSProperties = {
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const sizeBarFill: CSSProperties = {
  height: "100%",
  borderRadius: radius.pill,
  transition: `width ${transition.base}`,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const DependencyHealthView = memo(DependencyHealthViewImpl);
