interface DemoAppHeroProps {
  kicker: string;
  title: string;
  sub: string;
}

export function DemoAppHero({ kicker, title, sub }: DemoAppHeroProps) {
  return (
    <header className="demo-app__hero">
      <span className="demo-app__hero-kicker">{kicker}</span>
      <h1 className="demo-app__hero-title">{title}</h1>
      <p className="demo-app__hero-sub">{sub}</p>
    </header>
  );
}
