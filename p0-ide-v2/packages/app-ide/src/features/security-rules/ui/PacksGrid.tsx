import type { SecurityPack } from "@quanta/app-ide/entities/security-rules";
import { cn } from "@quanta/ui-kit/lib";

const S = {
  width: 16, height: 16, viewBox: "0 0 24 24",
  fill: "none" as const, stroke: "currentColor" as const,
  strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
};

const PACK_ICONS: Record<string, () => React.ReactNode> = {
  globe:       () => <svg {...S}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
  lock:        () => <svg {...S}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
  "eye-off":   () => <svg {...S}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" /><line x1="1" y1="1" x2="23" y2="23" /></svg>,
  "credit-card": () => <svg {...S}><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>,
  "file-text": () => <svg {...S}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  server:      () => <svg {...S}><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></svg>,
};

function PackCard({ pack }: { pack: SecurityPack }) {
  const Icon = PACK_ICONS[pack.icon];

  return (
    <div className={cn("sr-pack-card", !pack.enabled && "sr-pack-card--disabled")}>
      <div className="sr-pack-card__head">
        <span className="sr-pack-card__icon">
          {Icon ? <Icon /> : null}
        </span>
        <div className="sr-pack-card__info">
          <h3 className="sr-pack-card__name">{pack.name}</h3>
          <span className="sr-pack-card__rule-count">
            {pack.ruleCount} rule{pack.ruleCount !== 1 ? "s" : ""}
          </span>
        </div>
        <label className="sr-pack-card__toggle">
          <input type="checkbox" checked={pack.enabled} readOnly />
          <span className="sr-pack-card__toggle-track" />
        </label>
      </div>

      <p className="sr-pack-card__desc">{pack.description}</p>

      <div className="sr-pack-card__owasp">
        {pack.owaspCoverage.map((code) => (
          <span key={code} className="sr-pack-card__owasp-tag">{code}</span>
        ))}
      </div>

      {pack.builtIn && <span className="sr-pack-card__builtin">Built-in</span>}
    </div>
  );
}

interface Props {
  packs: SecurityPack[];
}

export function PacksGrid({ packs }: Props) {
  return (
    <div className="sr-packs-grid">
      {packs.map((pack) => (
        <PackCard key={pack.id} pack={pack} />
      ))}
    </div>
  );
}
