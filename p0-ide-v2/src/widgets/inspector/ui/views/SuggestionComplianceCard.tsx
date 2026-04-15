import type { ComplianceEvent } from "@/entities/compliance";

// ── RFC 2 · Compliance verifier card ─────────────────────────────────
export function ComplianceCard({ events }: { events: ComplianceEvent[] }) {
  if (events.length === 0) {
    return (
      <section className="comply comply--empty">
        <header className="comply__h">
          <span className="comply__label">Compliance</span>
          <span className="comply__sub">awaiting apply</span>
        </header>
        <p className="comply__hint">
          On <kbd>Apply</kbd>, engine runs {5} rule verifiers against this change set and issues evidence tokens for each pass.
        </p>
      </section>
    );
  }

  const pass = events.filter((e) => e.status === "pass").length;
  const fail = events.filter((e) => e.status === "fail").length;
  const unknown = events.filter((e) => e.status === "unknown").length;
  const lies = events.filter((e) => e.isLie).length;

  return (
    <section className={`comply${lies > 0 ? " has-lie" : ""}`}>
      <header className="comply__h">
        <span className="comply__label">Compliance</span>
        <span className="comply__sub">verifiers · this change</span>
        <span className="comply__pills">
          <span className="comply__pill comply__pill--pass">{pass} pass</span>
          {fail > 0 && <span className="comply__pill comply__pill--fail">{fail} fail</span>}
          {unknown > 0 && <span className="comply__pill comply__pill--unknown">{unknown} unk</span>}
          {lies > 0 && <span className="comply__pill comply__pill--lie">{lies} LIE</span>}
        </span>
      </header>
      <ul className="comply__list">
        {events.map((e) => (
          <li
            key={e.id}
            className={`comply__row comply__row--${e.status}${e.isLie ? " is-lie" : ""}`}
          >
            <span className={`comply__icon comply__icon--${e.status}`} aria-hidden>
              {e.status === "pass" ? "✓" : e.status === "fail" ? "✗" : "?"}
            </span>
            <div className="comply__text">
              <span className="comply__rule">{e.ruleLabel ?? e.verifierId}</span>
              {e.agentClaim && (
                <span className="comply__claim">
                  agent: <em>{e.agentClaim}</em>
                  {e.isLie && <span className="comply__mismatch"> ↯ mismatch</span>}
                </span>
              )}
              {e.violations && e.violations.length > 0 && (
                <span className="comply__violation">{e.violations[0].message}</span>
              )}
            </div>
            <span className="comply__engine">{e.engineSource}</span>
            {e.evidenceTokenId && (
              <span className="comply__token" title={`evidence token ${e.evidenceTokenId}`}>
                signed
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
