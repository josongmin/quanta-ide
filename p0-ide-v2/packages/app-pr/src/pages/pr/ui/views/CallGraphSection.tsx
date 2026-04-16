import type { CallEdge } from "./insights-view.mock";

export function CallGraphSection({ edges }: { edges: CallEdge[] }) {
  return (
    <section className="pr-page__ins-sec">
      <header className="pr-page__ins-head">
        <h3>Call graph changes</h3>
        <span className="pr-page__ins-sub">Impact paths tracked by the static engine</span>
      </header>
      <ul className="pr-page__ins-list">
        {edges.map((e) => (
          <li key={`${e.from}-${e.to}`} className="pr-page__ins-edge">
            <span className={`pr-page__ins-kind pr-page__ins-kind--${e.kind}`}>{e.kind}</span>
            <span className="pr-page__ins-from">{e.from}</span>
            <span className="pr-page__ins-arrow">→</span>
            <span className="pr-page__ins-to">{e.to}</span>
            <span className="pr-page__ins-hops">{e.hops} hop</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
