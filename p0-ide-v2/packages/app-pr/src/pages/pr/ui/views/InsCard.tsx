import { cn } from "@quanta/ui-kit/lib";
import type { InsDelta, InsTone } from "./insights-view.mock";
import { deltaClasses } from "./insights-view.utils";

export function InsCard({
  title,
  hero,
  unit,
  delta,
  sub,
  foot,
  tone,
  chart,
}: {
  title: string;
  hero: string;
  unit?: string;
  delta?: InsDelta;
  sub: string;
  foot: string;
  tone: InsTone;
  chart: React.ReactNode;
}) {
  const { isGood, isBad } = deltaClasses(delta, tone);
  return (
    <article className={`pr-page__ins-card pr-page__ins-card--${tone}`}>
      <header className="pr-page__ins-card-head">{title}</header>
      <div className="pr-page__ins-card-row">
        <div className="pr-page__ins-card-hero">
          {hero}
          {unit && <span className="pr-page__ins-card-unit">{unit}</span>}
        </div>
        {delta && (
          <span
            className={cn("pr-page__ins-card-delta", isGood && "is-good", isBad && "is-bad")}
          >
            <DeltaArrow dir={delta.dir} />
            {delta.value}
          </span>
        )}
      </div>
      <div className="pr-page__ins-card-sub">
        {sub}
        {delta?.from && <span className="pr-page__ins-card-from"> · {delta.from}</span>}
      </div>
      <div className="pr-page__ins-card-chart">{chart}</div>
      <footer className="pr-page__ins-card-foot">{foot}</footer>
    </article>
  );
}

function DeltaArrow({ dir }: { dir: InsDelta["dir"] }) {
  if (dir === "up") {
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 8l3-4 3 4" />
      </svg>
    );
  }
  if (dir === "down") {
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 4l3 4 3-4" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h6" />
    </svg>
  );
}
