import { cn } from "@quanta/ui-kit/lib";
import { TIER_LABEL, TIER_DESC, TIER_REVIEW_HINT, type HunkAttestation } from "@quanta/app-reviews/entities/proof-pr";

export function HunkRow({ hunk }: { hunk: HunkAttestation }) {
  const passCount = hunk.checks.filter((c) => c.status === "pass").length;
  const failCount = hunk.checks.filter((c) => c.status === "fail").length;
  const unknownCount = hunk.checks.filter((c) => c.status === "unknown").length;
  return (
    <li className={cn(`rev-hunk rev-hunk--${hunk.tier}`, hunk.tier === "risky" && "is-focus")}>
      <div className="rev-hunk__head">
        <span className={`rev-hunk__tier-badge rev-hunk__tier-badge--${hunk.tier}`}>
          {TIER_LABEL[hunk.tier]}
        </span>
        <span className="rev-hunk__file">{hunk.file}</span>
        <span className="rev-hunk__lines">L{hunk.lineRange[0]}&ndash;{hunk.lineRange[1]}</span>
        <span className="rev-hunk__hint" title={TIER_DESC[hunk.tier]}>
          {TIER_REVIEW_HINT[hunk.tier]}
        </span>
      </div>
      {hunk.note && <div className="rev-hunk__note">{hunk.note}</div>}
      <div className="rev-hunk__checks">
        {hunk.checks.map((c, i) => (
          <span key={i} className={`rev-hunk__check rev-hunk__check--${c.status}`}>
            <span className="rev-hunk__check-dot" aria-hidden />
            <span className="rev-hunk__check-verifier">{c.verifier}</span>
            {c.detail && <span className="rev-hunk__check-detail">{c.detail}</span>}
          </span>
        ))}
      </div>
      <div className="rev-hunk__foot">
        {hunk.riskBefore !== hunk.riskAfter && (
          <span className="rev-hunk__risk">
            risk {hunk.riskBefore} &rarr; <b>{hunk.riskAfter}</b>
          </span>
        )}
        <span className="rev-hunk__tally">
          {passCount > 0 && <span className="rev-hunk__tally-pass">{passCount} pass</span>}
          {failCount > 0 && <span className="rev-hunk__tally-fail">{failCount} fail</span>}
          {unknownCount > 0 && <span className="rev-hunk__tally-unk">{unknownCount} unk</span>}
        </span>
      </div>
    </li>
  );
}
