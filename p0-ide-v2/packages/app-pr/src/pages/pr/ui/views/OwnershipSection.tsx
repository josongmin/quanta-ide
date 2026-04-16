import type { OwnerEntry } from "./insights-view.mock";

export function OwnershipSection({ owners }: { owners: OwnerEntry[] }) {
  return (
    <section className="pr-page__ins-sec">
      <header className="pr-page__ins-head">
        <h3>Ownership</h3>
        <span className="pr-page__ins-sub">Owners of modules touched by this change</span>
      </header>
      <div className="pr-page__ins-owners">
        {owners.map((o) => (
          <div key={o.team} className="pr-page__ins-owner">
            <div className="pr-page__ins-owner-top">
              <span className="pr-page__ins-owner-team">{o.team}</span>
              <span className="pr-page__ins-owner-share">{Math.round(o.share * 100)}%</span>
            </div>
            <div className="pr-page__ins-owner-bar">
              <span style={{ width: `${o.share * 100}%` }} />
            </div>
            <div className="pr-page__ins-owner-foot">
              <span>@{o.owner}</span>
              <span>{o.files} files</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
