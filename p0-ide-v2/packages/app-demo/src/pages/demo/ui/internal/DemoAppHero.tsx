import type { ReactNode } from "react";

interface DemoAppHeroProps {
  kicker: string;
  title: ReactNode;
  sub: string;
  editorial?: boolean;
}

export function DemoAppHero({ kicker, title, sub, editorial }: DemoAppHeroProps) {
  return (
    <header className={"demo-app__hero" + (editorial ? " demo-app__hero--editorial" : "")}>
      <span className="demo-app__hero-kicker">{kicker}</span>
      <h1 className="demo-app__hero-title">{title}</h1>
      <p className="demo-app__hero-sub">{sub}</p>
    </header>
  );
}
