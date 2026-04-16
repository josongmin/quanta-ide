import type { FirewallStats, TrustLevel } from "@quanta/app-ide/entities/firewall";
import { TRUST_LABEL, TRUST_ORDER, fmt } from "./firewall-overlay.utils";

interface TrustDistributionProps {
  stats: FirewallStats;
  totalTokens: number;
}

export function TrustDistribution({ stats, totalTokens }: TrustDistributionProps) {
  return (
    <div className="fw-dist">
      <div className="fw-dist__label">Trust distribution</div>
      <div className="fw-dist__bar" aria-hidden>
        {(() => {
          let left = 0;
          return TRUST_ORDER.map((t) => {
            const tok = stats.byTrustTokens[t];
            const pct = totalTokens > 0 ? (tok / totalTokens) * 100 : 0;
            const l = left;
            left += pct;
            return (
              <span
                key={t}
                className={`fw-dist__seg fw-dist__seg--${t.replace("-", "")}`}
                style={{ left: `${l}%`, width: `${pct}%` }}
                title={`${t} · ${stats.byTrust[t]} chunks · ${fmt(tok)} tok`}
              />
            );
          });
        })()}
      </div>
      <TrustLegend stats={stats} />
    </div>
  );
}

function TrustLegend({ stats }: { stats: FirewallStats }) {
  return (
    <div className="fw-dist__legend">
      {TRUST_ORDER.map((t: TrustLevel) => (
        <span key={t} className={`fw-dist__chip fw-dist__chip--${t.replace("-", "")}`}>
          <span className="fw-dist__dot" aria-hidden />
          <span className="fw-dist__chip-label">{TRUST_LABEL[t]}</span>
          <span className="fw-dist__chip-count">{stats.byTrust[t]}</span>
          <span className="fw-dist__chip-tok">{fmt(stats.byTrustTokens[t])}</span>
        </span>
      ))}
    </div>
  );
}
