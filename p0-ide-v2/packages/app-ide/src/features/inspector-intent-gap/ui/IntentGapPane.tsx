import "./intent-gap-pane.css";
import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getIntentReport,
  type DriftEvent,
  type GapStatus,
  type IntentClaim,
  type IntentGap,
  type IntentReport,
  type IntentSource,
} from "@quanta/app-ide/entities/intent-gap";

const SOURCE_LABEL: Record<IntentSource, string> = {
  adr: "ADR",
  rfc: "RFC",
  docstring: "Docstring",
  "test-name": "TestName",
  "type-contract": "Type",
};

const SOURCE_FILTER_ORDER: IntentSource[] = [
  "adr",
  "rfc",
  "docstring",
  "test-name",
  "type-contract",
];

const STATUS_FILTER_ORDER: GapStatus[] = [
  "matches",
  "drifted",
  "violated",
  "missing",
];

const STATUS_LABEL: Record<GapStatus, string> = {
  matches: "Matches",
  drifted: "Drifted",
  violated: "Violated",
  missing: "Missing",
};

const STATUS_GLYPH: Record<GapStatus, string> = {
  matches: "✓",
  drifted: "△",
  violated: "✗",
  missing: "◌",
};

const STATUS_KEY: Record<GapStatus, "ok" | "warn" | "danger" | "muted"> = {
  matches: "ok",
  drifted: "warn",
  violated: "danger",
  missing: "muted",
};

// Timeline geometry — single source for SVG + axis label math.
const TL_W = 720;
const TL_H = 200;
const TL_PAD_L = 56;
const TL_PAD_R = 16;
const TL_PAD_T = 22;
const TL_PAD_B = 36;

interface TimelineDomain {
  start: number;
  end: number;
}

function parseDate(iso: string): number {
  // Treat ISO yyyy-mm-dd as UTC midnight to keep math deterministic.
  return new Date(`${iso}T00:00:00Z`).getTime();
}

function formatDate(iso: string): string {
  return iso;
}

function timelineDomain(report: IntentReport): TimelineDomain {
  const all: number[] = [];
  for (const c of report.claims) all.push(parseDate(c.authoredAt));
  for (const e of report.driftTimeline) all.push(parseDate(e.date));
  if (all.length === 0) {
    const now = Date.now();
    return { start: now - 1, end: now };
  }
  const start = Math.min(...all);
  // End at "today" anchor (latest of: latest event, current time).
  const latest = Math.max(...all);
  const end = Math.max(latest, Date.now());
  if (start === end) return { start, end: end + 1 };
  return { start, end };
}

function dateToX(t: number, domain: TimelineDomain): number {
  const usable = TL_W - TL_PAD_L - TL_PAD_R;
  const ratio = (t - domain.start) / (domain.end - domain.start);
  return TL_PAD_L + Math.max(0, Math.min(1, ratio)) * usable;
}

interface HeaderProps {
  report: IntentReport;
}

function ScoreGauge({ score }: { score: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = c * pct;
  // Score tone bins — ≥80 healthy, ≥60 warn, else danger.
  const tone = score >= 80 ? "ok" : score >= 60 ? "warn" : "danger";
  return (
    <div className={`igap-pane__gauge igap-pane__gauge--${tone}`}>
      <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
        <circle cx="38" cy="38" r={r} className="igap-pane__gauge-track" />
        <circle
          cx="38"
          cy="38"
          r={r}
          className="igap-pane__gauge-fill"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 38 38)"
        />
      </svg>
      <div className="igap-pane__gauge-label">
        <span className="igap-pane__gauge-num">{score}</span>
        <span className="igap-pane__gauge-unit">/100</span>
      </div>
    </div>
  );
}

function Header({ report }: HeaderProps) {
  const counts = useMemo(() => {
    const c: Record<GapStatus, number> = {
      matches: 0,
      drifted: 0,
      violated: 0,
      missing: 0,
    };
    for (const g of report.gaps) c[g.status] += 1;
    return c;
  }, [report.gaps]);

  return (
    <div className="igap-pane__head">
      <ScoreGauge score={report.alignmentScore} />
      <div className="igap-pane__head-tiles">
        {STATUS_FILTER_ORDER.map((s) => (
          <div
            key={s}
            className={`igap-pane__tile igap-pane__tile--${STATUS_KEY[s]}`}
          >
            <div className="igap-pane__tile-glyph" aria-hidden="true">
              {STATUS_GLYPH[s]}
            </div>
            <div className="igap-pane__tile-body">
              <div className="igap-pane__tile-v">{counts[s]}</div>
              <div className="igap-pane__tile-k">{STATUS_LABEL[s]}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FilterRowProps {
  sources: Set<IntentSource>;
  statuses: Set<GapStatus>;
  onToggleSource: (s: IntentSource) => void;
  onToggleStatus: (s: GapStatus) => void;
}

function FilterRow({
  sources,
  statuses,
  onToggleSource,
  onToggleStatus,
}: FilterRowProps) {
  return (
    <div className="igap-pane__filters">
      <div className="igap-pane__filter-group">
        <span className="igap-pane__filter-label">Source</span>
        {SOURCE_FILTER_ORDER.map((s) => {
          const on = sources.has(s);
          return (
            <button
              type="button"
              key={s}
              className={
                "igap-pane__chip igap-pane__chip--source" +
                (on ? " is-on" : "")
              }
              onClick={() => onToggleSource(s)}
              aria-pressed={on}
            >
              {SOURCE_LABEL[s]}
            </button>
          );
        })}
      </div>
      <div className="igap-pane__filter-group">
        <span className="igap-pane__filter-label">Status</span>
        {STATUS_FILTER_ORDER.map((s) => {
          const on = statuses.has(s);
          return (
            <button
              type="button"
              key={s}
              className={
                `igap-pane__chip igap-pane__chip--status igap-pane__chip--${STATUS_KEY[s]}` +
                (on ? " is-on" : "")
              }
              onClick={() => onToggleStatus(s)}
              aria-pressed={on}
            >
              <span className="igap-pane__chip-glyph" aria-hidden="true">
                {STATUS_GLYPH[s]}
              </span>
              {STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface LedgerRowProps {
  claim: IntentClaim;
  gap: IntentGap;
}

function LedgerRow({ claim, gap }: LedgerRowProps) {
  const tone = STATUS_KEY[gap.status];
  return (
    <li className={`igap-pane__row igap-pane__row--${tone}`}>
      <div className="igap-pane__row-grid">
        {/* Left — claim card */}
        <div className="igap-pane__claim">
          <div className="igap-pane__claim-meta">
            <span
              className={`igap-pane__source igap-pane__source--${claim.source}`}
            >
              {SOURCE_LABEL[claim.source]}
            </span>
            <span className="igap-pane__ref">{claim.sourceRef}</span>
            <span className="igap-pane__date">{formatDate(claim.authoredAt)}</span>
          </div>
          <div className="igap-pane__claim-text">{claim.text}</div>
        </div>

        {/* Center — status badge */}
        <div className="igap-pane__status">
          <div className={`igap-pane__badge igap-pane__badge--${tone}`}>
            <span className="igap-pane__badge-glyph" aria-hidden="true">
              {STATUS_GLYPH[gap.status]}
            </span>
            <span className="igap-pane__badge-label">
              {STATUS_LABEL[gap.status]}
            </span>
          </div>
        </div>

        {/* Right — implementation evidence */}
        <div className="igap-pane__evidence">
          {gap.evidence ? (
            <>
              <div className="igap-pane__evidence-meta">
                <span className="igap-pane__symbol">{gap.evidence.symbolPath}</span>
                <span className="igap-pane__line">L{gap.evidence.line}</span>
              </div>
              <pre className="igap-pane__snippet">
                <code>{gap.evidence.snippet}</code>
              </pre>
            </>
          ) : (
            <div className="igap-pane__evidence-empty">No evidence found</div>
          )}
        </div>
      </div>

      <div className="igap-pane__rationale">{gap.rationale}</div>

      {(gap.introducedAt ?? gap.introducedBy) && (
        <div className="igap-pane__chip-row">
          {gap.introducedAt && (
            <span className="igap-pane__intro-chip">
              <span className="igap-pane__intro-key">introduced</span>
              <span className="igap-pane__intro-date">
                {formatDate(gap.introducedAt)}
              </span>
              {gap.introducedBy && (
                <>
                  <span className="igap-pane__intro-sep">·</span>
                  <span className="igap-pane__intro-by">{gap.introducedBy}</span>
                </>
              )}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

interface TimelineProps {
  report: IntentReport;
}

function DriftTimeline({ report }: TimelineProps) {
  const domain = useMemo(() => timelineDomain(report), [report]);

  // Group drift events per claim so we can connect "evolution" lines.
  const grouped = useMemo(() => {
    const m = new Map<string, DriftEvent[]>();
    for (const e of report.driftTimeline) {
      const arr = m.get(e.claimId) ?? [];
      arr.push(e);
      m.set(e.claimId, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    }
    return m;
  }, [report.driftTimeline]);

  const claimById = useMemo(() => {
    const m = new Map<string, IntentClaim>();
    for (const c of report.claims) m.set(c.id, c);
    return m;
  }, [report.claims]);

  // Stable lane assignment per claim — keeps connector lines from overlapping.
  const claimLane = useMemo(() => {
    const lanes = new Map<string, number>();
    let i = 0;
    for (const claimId of grouped.keys()) {
      lanes.set(claimId, i);
      i += 1;
    }
    return lanes;
  }, [grouped]);

  const laneCount = Math.max(1, grouped.size);
  const laneSpan = TL_H - TL_PAD_T - TL_PAD_B;
  const laneStep = laneSpan / Math.max(laneCount, 1);

  const startISO = new Date(domain.start).toISOString().slice(0, 10);
  const endISO = new Date(domain.end).toISOString().slice(0, 10);
  const midISO = new Date((domain.start + domain.end) / 2)
    .toISOString()
    .slice(0, 10);

  return (
    <div className="igap-pane__timeline">
      <div className="igap-pane__timeline-title">Drift timeline</div>
      <svg
        viewBox={`0 0 ${TL_W} ${TL_H}`}
        className="igap-pane__timeline-svg"
        preserveAspectRatio="xMinYMid meet"
        role="img"
        aria-label="Drift timeline of intent gaps"
      >
        {/* Axis baseline */}
        <line
          x1={TL_PAD_L}
          x2={TL_W - TL_PAD_R}
          y1={TL_H - TL_PAD_B}
          y2={TL_H - TL_PAD_B}
          className="igap-pane__timeline-axis"
        />
        {/* Axis ticks */}
        {[domain.start, (domain.start + domain.end) / 2, domain.end].map(
          (t, i) => (
            <line
              key={i}
              x1={dateToX(t, domain)}
              x2={dateToX(t, domain)}
              y1={TL_H - TL_PAD_B}
              y2={TL_H - TL_PAD_B + 4}
              className="igap-pane__timeline-tick"
            />
          ),
        )}
        {/* Axis labels */}
        <text
          x={TL_PAD_L}
          y={TL_H - TL_PAD_B + 18}
          className="igap-pane__timeline-axis-label"
          textAnchor="start"
        >
          {startISO}
        </text>
        <text
          x={(TL_PAD_L + TL_W - TL_PAD_R) / 2}
          y={TL_H - TL_PAD_B + 18}
          className="igap-pane__timeline-axis-label"
          textAnchor="middle"
        >
          {midISO}
        </text>
        <text
          x={TL_W - TL_PAD_R}
          y={TL_H - TL_PAD_B + 18}
          className="igap-pane__timeline-axis-label"
          textAnchor="end"
        >
          {endISO}
        </text>

        {/* Per-claim evolution rails */}
        {Array.from(grouped.entries()).map(([claimId, events]) => {
          const lane = claimLane.get(claimId) ?? 0;
          const y = TL_PAD_T + laneStep * lane + laneStep / 2;
          const claim = claimById.get(claimId);
          const xs = events.map((e) => dateToX(parseDate(e.date), domain));
          const x0 = Math.min(...xs);
          const x1 = Math.max(...xs);
          const lastStatus = events[events.length - 1].status;
          return (
            <g
              key={claimId}
              className={`igap-pane__timeline-rail igap-pane__timeline-rail--${STATUS_KEY[lastStatus]}`}
            >
              {events.length > 1 && (
                <line
                  x1={x0}
                  x2={x1}
                  y1={y}
                  y2={y}
                  className="igap-pane__timeline-connect"
                />
              )}
              {events.map((e) => (
                <g key={`${claimId}-${e.date}`}>
                  <circle
                    cx={dateToX(parseDate(e.date), domain)}
                    cy={y}
                    r={5}
                    className={`igap-pane__timeline-marker igap-pane__timeline-marker--${STATUS_KEY[e.status]}`}
                  />
                </g>
              ))}
              <text
                x={x1 + 8}
                y={y + 3}
                className="igap-pane__timeline-rail-label"
              >
                {claim ? claim.sourceRef : claimId}
              </text>
            </g>
          );
        })}

        {grouped.size === 0 && (
          <text
            x={TL_W / 2}
            y={TL_H / 2}
            textAnchor="middle"
            className="igap-pane__timeline-empty"
          >
            no drift recorded
          </text>
        )}
      </svg>
    </div>
  );
}

interface EmptyViewProps {
  fileName: string;
}

function EmptyView({ fileName }: EmptyViewProps) {
  return (
    <div className="igap-pane igap-pane--empty">
      <div className="igap-pane__empty-body">
        <div className="igap-pane__empty-title">No documented intent</div>
        <div className="igap-pane__empty-hint">
          No ADRs, RFCs, docstrings, test names, or type contracts have been
          mined for <code className="igap-pane__mono">{fileName}</code>.
        </div>
      </div>
    </div>
  );
}

export function IntentGapPane({ file }: { file: FileFacts }) {
  const report = getIntentReport(file.name);

  const [activeSources, setActiveSources] = useState<Set<IntentSource>>(
    () => new Set(SOURCE_FILTER_ORDER),
  );
  const [activeStatuses, setActiveStatuses] = useState<Set<GapStatus>>(
    () => new Set(STATUS_FILTER_ORDER),
  );

  const claimById = useMemo(() => {
    const m = new Map<string, IntentClaim>();
    if (!report) return m;
    for (const c of report.claims) m.set(c.id, c);
    return m;
  }, [report]);

  const visibleRows = useMemo(() => {
    if (!report) return [];
    const rows: Array<{ claim: IntentClaim; gap: IntentGap }> = [];
    for (const gap of report.gaps) {
      const claim = claimById.get(gap.claimId);
      if (!claim) continue;
      if (!activeSources.has(claim.source)) continue;
      if (!activeStatuses.has(gap.status)) continue;
      rows.push({ claim, gap });
    }
    return rows;
  }, [report, claimById, activeSources, activeStatuses]);

  const criticalCount = useMemo(() => {
    if (!report) return 0;
    return report.gaps.filter(
      (g) =>
        (g.status === "violated" || g.status === "missing") &&
        g.severity === "danger",
    ).length;
  }, [report]);

  if (!report) return <EmptyView fileName={file.name} />;

  const toggleSource = (s: IntentSource) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleStatus = (s: GapStatus) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  return (
    <div className="igap-pane">
      {criticalCount > 0 && (
        <div className="igap-pane__alert" role="alert">
          <span className="igap-pane__alert-glyph" aria-hidden="true">
            ⚠
          </span>
          <span className="igap-pane__alert-text">
            <strong>{criticalCount}</strong> critical intent violation
            {criticalCount === 1 ? "" : "s"}. Document promises code does not
            keep.
          </span>
        </div>
      )}

      <Header report={report} />

      <FilterRow
        sources={activeSources}
        statuses={activeStatuses}
        onToggleSource={toggleSource}
        onToggleStatus={toggleStatus}
      />

      <ul className="igap-pane__ledger">
        {visibleRows.length === 0 ? (
          <li className="igap-pane__ledger-empty">No claims match the active filters.</li>
        ) : (
          visibleRows.map(({ claim, gap }) => (
            <LedgerRow key={claim.id} claim={claim} gap={gap} />
          ))
        )}
      </ul>

      <DriftTimeline report={report} />

      <div className="igap-pane__foot">
        Specification mining · semantic diff · file:{" "}
        <code className="igap-pane__mono">{file.name}</code>
      </div>
    </div>
  );
}
