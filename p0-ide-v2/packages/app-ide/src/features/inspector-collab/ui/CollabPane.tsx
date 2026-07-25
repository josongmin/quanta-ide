import "./collab-pane.css";
import { useMemo } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getCollabReport,
  type CollabReport,
  type ReviewerCandidate,
  type TeamLoad,
} from "@quanta/app-ide/entities/collab";

/* ── Score → tier ─────────────────────────────────────────── */
type ScoreTier = "good" | "warn" | "bad";
function scoreTier(score: number): ScoreTier {
  if (score >= 75) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

/* ── Team palette resolver (CSS class fragment) ───────────── */
const TEAM_VARIANTS: ReadonlySet<string> = new Set([
  "platform",
  "security",
  "qa",
  "data",
  "design",
]);
function teamVariant(team: string): string {
  return TEAM_VARIANTS.has(team) ? team : "default";
}

/* ── Number clamp helper ──────────────────────────────────── */
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/* ── Sort: bottleneck teams first ─────────────────────────── */
function sortTeams(teamLoad: readonly TeamLoad[], bottleneck: readonly string[]): TeamLoad[] {
  const isBottle = new Set(bottleneck);
  return [...teamLoad].sort((a, b) => {
    const ab = isBottle.has(a.team) ? 1 : 0;
    const bb = isBottle.has(b.team) ? 1 : 0;
    if (ab !== bb) return bb - ab;
    return b.loadPct - a.loadPct;
  });
}

/* ── Candidate row ────────────────────────────────────────── */
function CandidateRow({ c }: { c: ReviewerCandidate }) {
  const tier = scoreTier(c.score);
  const team = teamVariant(c.team);
  const initial = c.handle.replace(/^@/, "").charAt(0) || "?";

  // Mini-bar values (0–100 scaled)
  const blamePct = clamp(c.blameMatchPct, 0, 100);
  const expertPct = clamp(c.expertise90d, 0, 100);
  const queueRatio = c.queueCapacity > 0 ? c.pursuingQueue / c.queueCapacity : 1;
  const queuePct = clamp(queueRatio * 100, 0, 100);
  const queueOver = queueRatio > 1;
  // TZ overlap: 0–12h scaled to 0–100
  const tzPct = clamp((c.tzOverlapHrs / 12) * 100, 0, 100);

  const rowClasses = ["collab-pane__row"];
  if (c.outOfOffice) rowClasses.push("collab-pane__row--ooo");

  return (
    <li className={rowClasses.join(" ")}>
      <div className="collab-pane__row-avatar">
        <span
          className={`collab-pane__avatar collab-pane__avatar--${team}`}
          aria-hidden="true"
        >
          {initial}
        </span>
      </div>

      <div className="collab-pane__row-id">
        <span className="collab-pane__row-handle">{c.handle}</span>
        <span className="collab-pane__chip collab-pane__chip--team">
          <span
            className="collab-pane__chip-dot"
            style={{ background: `var(--collab-team-${team})` }}
          />
          {c.team}
        </span>
        <span className="collab-pane__chip collab-pane__chip--tz">{c.tz}</span>
        <span className="collab-pane__badges">
          {c.onCall && (
            <span className="collab-pane__badge collab-pane__badge--oncall" title="on call">
              <span aria-hidden="true">⚡</span>
              on-call
            </span>
          )}
          {c.outOfOffice && (
            <span className="collab-pane__badge collab-pane__badge--ooo" title="out of office">
              <span aria-hidden="true">✈</span>
              OOO
            </span>
          )}
          {c.recentReviewsThisFile30d > 0 && (
            <span
              className="collab-pane__badge collab-pane__badge--recent"
              title={`Reviewed this file ${c.recentReviewsThisFile30d}× in last 30d`}
            >
              <span aria-hidden="true">↻</span>
              {c.recentReviewsThisFile30d}
            </span>
          )}
        </span>
      </div>

      <div
        className={`collab-pane__row-score collab-pane__row-score--${tier}`}
        aria-label={`Score ${c.score}`}
      >
        {c.score}
      </div>

      <div className="collab-pane__bars">
        <div className="collab-pane__bar collab-pane__bar--blame">
          <div className="collab-pane__bar-label">
            <span>blame</span>
            <span className="collab-pane__bar-val">{c.blameMatchPct}%</span>
          </div>
          <div className="collab-pane__bar-track">
            <span className="collab-pane__bar-fill" style={{ width: `${blamePct}%` }} />
          </div>
        </div>
        <div className="collab-pane__bar collab-pane__bar--expert">
          <div className="collab-pane__bar-label">
            <span>expert</span>
            <span className="collab-pane__bar-val">{c.expertise90d}</span>
          </div>
          <div className="collab-pane__bar-track">
            <span className="collab-pane__bar-fill" style={{ width: `${expertPct}%` }} />
          </div>
        </div>
        <div
          className={`collab-pane__bar collab-pane__bar--queue${queueOver ? " is-over" : ""}`}
        >
          <div className="collab-pane__bar-label">
            <span>queue</span>
            <span className="collab-pane__bar-val">
              {c.pursuingQueue}/{c.queueCapacity}
            </span>
          </div>
          <div className="collab-pane__bar-track">
            <span className="collab-pane__bar-fill" style={{ width: `${queuePct}%` }} />
          </div>
        </div>
        <div className="collab-pane__bar collab-pane__bar--tz">
          <div className="collab-pane__bar-label">
            <span>tz</span>
            <span className="collab-pane__bar-val">{c.tzOverlapHrs}h</span>
          </div>
          <div className="collab-pane__bar-track">
            <span className="collab-pane__bar-fill" style={{ width: `${tzPct}%` }} />
          </div>
        </div>
      </div>

      <div className="collab-pane__row-foot">
        <div className="collab-pane__reasons" title={c.reasons.join(" · ")}>
          {c.reasons.join(" · ")}
        </div>
        <button
          type="button"
          className="collab-pane__cta"
          aria-label={`Send review request to ${c.handle}`}
        >
          Send review request
        </button>
      </div>
    </li>
  );
}

/* ── Recommended (top-K) row ──────────────────────────────── */
function RecommendedCard({ c, rank }: { c: ReviewerCandidate; rank: number }) {
  const tier = scoreTier(c.score);
  const team = teamVariant(c.team);
  const initial = c.handle.replace(/^@/, "").charAt(0) || "?";
  const cls = ["collab-pane__rec-card"];
  if (rank === 1) cls.push("collab-pane__rec-card--top");

  return (
    <div className={cls.join(" ")}>
      <div className="collab-pane__rec-rank">#{rank}</div>
      <div className="collab-pane__rec-head">
        <span
          className={`collab-pane__avatar collab-pane__avatar--${team}`}
          aria-hidden="true"
        >
          {initial}
        </span>
        <span className="collab-pane__rec-handle">{c.handle}</span>
        <span className={`collab-pane__rec-score collab-pane__row-score--${tier}`}>
          {c.score}
        </span>
      </div>
      <div className="collab-pane__rec-meta">
        {c.team} · blame {c.blameMatchPct}% · expert {c.expertise90d}
      </div>
    </div>
  );
}

/* ── Team-load row ────────────────────────────────────────── */
function TeamLoadRow({ t, isBottleneck }: { t: TeamLoad; isBottleneck: boolean }) {
  const cls = ["collab-pane__team"];
  if (isBottleneck) cls.push("collab-pane__team--bottleneck");
  // Bar fill: capped at 100%, but if overloaded show in red
  const fillPct = clamp(t.loadPct, 0, 100);
  const overloaded = t.loadPct > 100;
  const fillCls = ["collab-pane__team-fill"];
  if (overloaded) fillCls.push("collab-pane__team-fill--over");

  return (
    <div className={cls.join(" ")}>
      <div className="collab-pane__team-head">
        {isBottleneck && (
          <span className="collab-pane__team-warn" aria-hidden="true">
            ⚠
          </span>
        )}
        <span className="collab-pane__team-name">{t.team}</span>
        <span className="collab-pane__team-frac">
          {t.totalQueue}/{t.totalCapacity}
        </span>
      </div>
      <div className="collab-pane__team-bar" aria-label={`Load ${t.loadPct}%`}>
        <span className={fillCls.join(" ")} style={{ width: `${fillPct}%` }} />
      </div>
      <div className="collab-pane__team-meta">
        {t.members} {t.members === 1 ? "member" : "members"} · load {Math.round(t.loadPct)}%
      </div>
    </div>
  );
}

/* ── Main pane ────────────────────────────────────────────── */
export function CollabPane({ file }: { file: FileFacts }) {
  const report: CollabReport | null = useMemo(
    () => getCollabReport(file.name),
    [file.name],
  );

  const sortedTeams = useMemo<TeamLoad[]>(() => {
    if (!report) return [];
    return sortTeams(report.teamLoad, report.bottleneckTeams);
  }, [report]);

  if (!report) {
    return (
      <div className="collab-pane">
        <div className="collab-pane__empty">
          No reviewer routing report available for <strong>{file.name}</strong>.
        </div>
      </div>
    );
  }

  const candidatesById = new Map(report.candidates.map((c) => [c.id, c]));
  const topK: ReviewerCandidate[] = report.recommendedTopK
    .map((id) => candidatesById.get(id))
    .filter((c): c is ReviewerCandidate => c !== undefined);
  const topPick = topK[0] ?? null;
  const overloadedCount = report.bottleneckTeams.length;

  return (
    <div className="collab-pane">
      {/* ── Header stats ──────────────────────────────────── */}
      <div className="collab-pane__head">
        <div className="collab-pane__stat">
          <div className="collab-pane__stat-v">{report.candidates.length}</div>
          <div className="collab-pane__stat-k">candidates</div>
        </div>
        <div className="collab-pane__stat">
          <div className="collab-pane__stat-v collab-pane__stat-v--good">
            {topPick ? `${topPick.handle} · ${topPick.score}` : "—"}
          </div>
          <div className="collab-pane__stat-k">top pick</div>
        </div>
        <div className="collab-pane__stat">
          <div
            className={
              overloadedCount > 0
                ? "collab-pane__stat-v collab-pane__stat-v--bad"
                : "collab-pane__stat-v"
            }
          >
            {overloadedCount}
          </div>
          <div className="collab-pane__stat-k">teams overloaded</div>
        </div>
      </div>

      {/* ── Body: list + radar ────────────────────────────── */}
      <div className="collab-pane__body">
        <div className="collab-pane__main">
          {/* Recommended row */}
          {topK.length > 0 && (
            <section aria-label="Recommended reviewers">
              <div className="collab-pane__rec-title">
                Recommended · top {topK.length}
              </div>
              <div className="collab-pane__rec">
                {topK.map((c, i) => (
                  <RecommendedCard key={c.id} c={c} rank={i + 1} />
                ))}
              </div>
            </section>
          )}

          {/* Full ranking list */}
          <section aria-label="All candidates">
            <div className="collab-pane__list-title">
              Ranking · {report.candidates.length} candidates
            </div>
            <ul className="collab-pane__list">
              {report.candidates.map((c) => (
                <CandidateRow key={c.id} c={c} />
              ))}
            </ul>
          </section>
        </div>

        {/* Team-load radar */}
        <aside className="collab-pane__radar" aria-label="Team load radar">
          <div className="collab-pane__radar-title">Team load</div>
          {sortedTeams.map((t) => (
            <TeamLoadRow
              key={t.team}
              t={t}
              isBottleneck={report.bottleneckTeams.includes(t.team)}
            />
          ))}
        </aside>
      </div>

      {/* ── Footer ────────────────────────────────────────── */}
      <div className="collab-pane__foot">
        <span>Reviewer routing</span>
        <span className="collab-pane__foot-sep">·</span>
        <span>blame × expertise × queue × TZ</span>
        <span className="collab-pane__foot-sep">·</span>
        <span>
          author <strong>{report.authorHandle}</strong> ({report.authorTz})
        </span>
      </div>
    </div>
  );
}
