import {
  useComplianceStore,
  type ComplianceEvent,
  type SessionStats,
} from "@/entities/compliance";

// ── RFC 2 · Compliance session section ─────────────────────────────
export function ComplianceSection() {
  const events = useComplianceStore((s) => s.events);
  const tokens = useComplianceStore((s) => s.tokens);
  const stats: SessionStats = {
    total: events.length,
    pass: events.filter((e) => e.status === "pass").length,
    fail: events.filter((e) => e.status === "fail").length,
    unknown: events.filter((e) => e.status === "unknown").length,
    liesDetected: events.filter((e) => e.isLie).length,
    tokensIssued: tokens.length,
    tokensRevoked: tokens.filter((t) => t.revoked).length,
  };

  const recent = [...events].sort((a, b) => b.ts - a.ts).slice(0, 6);
  const lies = events.filter((e) => e.isLie);

  const passPct = stats.total > 0 ? (stats.pass / stats.total) * 100 : 0;

  return (
    <div className="comply-sec">
      <div className="comply-sec__head">
        <span className="comply-sec__label">Compliance</span>
        <span className="comply-sec__sub">session · rule verifiers</span>
        <span className="comply-sec__right">
          {stats.tokensIssued} tokens issued · {stats.tokensRevoked} revoked
        </span>
      </div>
      <div className="comply-sec__grid">
        <ComplyScoreCard stats={stats} passPct={passPct} />
        <ComplyRulesCard events={recent} />
        <ComplyLieCard lies={lies} />
      </div>
    </div>
  );
}

function ComplyScoreCard({ stats, passPct }: { stats: SessionStats; passPct: number }) {
  const tone = stats.liesDetected > 0 ? "danger" : stats.fail > 0 ? "warn" : "success";
  return (
    <section className="comply-card comply-card--score">
      <header className="comply-card__h">
        <span className="comply-card__label">Score</span>
        <span className="comply-card__count">/{stats.total}</span>
      </header>

      <div className="comply-score">
        <span className={`comply-score__num comply-score__num--${tone}`}>{stats.pass}</span>
        <div className="comply-score__meta">
          <span className={`comply-score__pill comply-score__pill--${tone}`}>
            <span className="comply-score__dot" />
            {stats.liesDetected > 0 ? "lies found" : stats.fail > 0 ? "fails" : "all pass"}
          </span>
          <div className="comply-score__track">
            <span className={`comply-score__fill comply-score__fill--${tone}`} style={{ width: `${passPct}%` }} />
          </div>
        </div>
      </div>

      <div className="agst-substats agst-substats--3">
        <div className="agst-st">
          <span className="agst-st__v">{stats.pass}</span>
          <span className="agst-st__k">Pass</span>
        </div>
        <div className={`agst-st${stats.fail > 0 ? " agst-st--warn" : ""}`}>
          <span className="agst-st__v">{stats.fail}</span>
          <span className="agst-st__k">Fail</span>
        </div>
        <div className="agst-st">
          <span className="agst-st__v">{stats.unknown}</span>
          <span className="agst-st__k">Unk</span>
        </div>
      </div>
    </section>
  );
}

function ComplyRulesCard({ events }: { events: ComplianceEvent[] }) {
  return (
    <section className="comply-card comply-card--rules">
      <header className="comply-card__h">
        <span className="comply-card__label">Recent rules</span>
        <span className="comply-card__count">{events.length}</span>
      </header>
      {events.length === 0 ? (
        <p className="comply-card__empty">No verifier runs yet this session.</p>
      ) : (
        <ul className="comply-rule">
          {events.map((e) => (
            <li
              key={e.id}
              className={`comply-rule__row comply-rule__row--${e.status}${e.isLie ? " is-lie" : ""}`}
            >
              <span className={`comply-rule__icon comply-rule__icon--${e.status}`} aria-hidden>
                {e.status === "pass" ? "✓" : e.status === "fail" ? "✗" : "?"}
              </span>
              <span className="comply-rule__label" title={e.ruleLabel ?? e.verifierId}>
                {e.ruleLabel ?? e.verifierId}
              </span>
              <span className="comply-rule__engine">{e.engineSource}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ComplyLieCard({ lies }: { lies: ComplianceEvent[] }) {
  return (
    <section className="comply-card comply-card--lie">
      <header className="comply-card__h">
        <span className="comply-card__label">Lie log</span>
        <span className="comply-card__count">{lies.length}</span>
      </header>
      {lies.length === 0 ? (
        <p className="comply-card__empty">No claim ↔ engine mismatches.</p>
      ) : (
        <ul className="comply-lie">
          {lies.map((l) => (
            <li key={l.id} className="comply-lie__row">
              <span className="comply-lie__icon" aria-hidden>!</span>
              <div className="comply-lie__body">
                <span className="comply-lie__change">{l.changeSetLabel}</span>
                <span className="comply-lie__claim">
                  agent claimed <em>{l.agentClaim}</em> · {l.engineSource} disagreed
                </span>
                {l.violations && l.violations.length > 0 && (
                  <span className="comply-lie__detail">{l.violations[0].message}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {lies.length > 0 && (
        <p className="comply-card__foot comply-card__foot--warn">
          lies are kept in the compliance log permanently; review at session close
        </p>
      )}
    </section>
  );
}
