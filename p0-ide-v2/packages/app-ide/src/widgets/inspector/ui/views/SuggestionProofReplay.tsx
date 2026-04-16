import type { ProofReplayData } from "./SuggestionOverlay.types";

// ── Topic ③ · Proof replay (post-apply verification) ─────────────────
export function ProofReplay({ data }: { data: ProofReplayData }) {
  const passCount = data.checks.filter((c) => c.pass).length;
  const allPass = passCount === data.checks.length;
  return (
    <section className={`proof proof--${data.status}`}>
      <header className="proof__h">
        <span className="proof__label">Proof replay</span>
        <span className={`proof__pill proof__pill--${data.status}`}>
          <span className="proof__dot" aria-hidden />
          {data.status === "verified" ? "verified" : data.status === "failed" ? "failed" : "pending"}
        </span>
        {data.verifiedAt && <span className="proof__when">{data.verifiedAt}</span>}
      </header>

      {data.status === "pending" ? (
        <div className="proof__pending">
          <p className="proof__pending-lead">
            Apply to run post-check — engine will re-run {data.checks.length} verifications against the applied patch.
          </p>
          <ul className="proof__preview">
            {data.checks.map((c, i) => (
              <li key={i} className="proof__preview-row">
                <span className="proof__preview-dot" aria-hidden />
                <span className="proof__preview-label">{c.label}</span>
                <span className="proof__preview-engine">{c.engine}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="proof__summary">
            <span className="proof__pass">{passCount} / {data.checks.length} passed</span>
            {allPass && <span className="proof__banner">behavior preserved · no regressions</span>}
          </div>
          <ul className="proof__checks">
            {data.checks.map((c, i) => (
              <li key={i} className={`proof__check${c.pass ? " is-pass" : " is-fail"}`}>
                <span className="proof__check-icon" aria-hidden>{c.pass ? "✓" : "✗"}</span>
                <span className="proof__check-label">{c.label}</span>
                {c.sample && <span className="proof__check-sample">{c.sample}</span>}
                <span className="proof__check-engine">{c.engine}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
