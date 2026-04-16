import type { IncidentEntry } from "./insights-view.mock";

export function IncidentSection({ incidents }: { incidents: IncidentEntry[] }) {
  return (
    <section className="pr-page__ins-sec">
      <header className="pr-page__ins-head">
        <h3>Past incident similarity</h3>
        <span className="pr-page__ins-sub">Prior incidents with overlapping structural patterns</span>
      </header>
      <ul className="pr-page__ins-incidents">
        {incidents.map((i) => (
          <li key={i.id} className="pr-page__ins-inc">
            <span className="pr-page__ins-inc-id">{i.id}</span>
            <span className="pr-page__ins-inc-title">{i.title}</span>
            <span className="pr-page__ins-inc-bar">
              <span style={{ width: `${i.sim * 100}%` }} />
            </span>
            <span className="pr-page__ins-inc-sim">{Math.round(i.sim * 100)}%</span>
            <span className="pr-page__ins-inc-when">{i.when}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
