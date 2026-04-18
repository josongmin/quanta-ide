import { CATEGORIES, pagesByCategory, type CategoryId } from "../demo-registry";
import { useDemoNav } from "../DemoPage";

export function CatalogPage() {
  const nav = useDemoNav();
  const interactive = CATEGORIES.filter((c) => c.id !== "catalog");
  return (
    <div className="demo-catalog">
      <header className="demo-catalog__hero">
        <div className="demo-catalog__kicker">Try demo</div>
        <h1 className="demo-catalog__title">Every SaaS surface, click-through ready.</h1>
        <p className="demo-catalog__sub">
          These are high-fidelity mockups meant to feel real. Nothing here talks to a backend —
          explore the flows, push the buttons, then tell us which ones we should actually ship.
        </p>
      </header>

      {interactive.map((cat) => (
        <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
          <div className="demo-sectionbar" style={{ marginTop: "var(--space-5)" }}>
            <span className="demo-catalog__card-icon" aria-hidden>{cat.icon}</span>
            <div>
              <div id={`cat-${cat.id}`} className="demo-sectionbar__title">{cat.label}</div>
              <div className="demo-sectionbar__desc">{cat.blurb}</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <span className="demo-badge">{pagesByCategory(cat.id).length} screens</span>
          </div>
          <CatGrid catId={cat.id} onOpen={nav.navigate} />
        </section>
      ))}
    </div>
  );
}

function CatGrid({ catId, onOpen }: { catId: CategoryId; onOpen: (id: string) => void }) {
  const pages = pagesByCategory(catId);
  return (
    <div className="demo-catalog__grid">
      {pages.map((p) => (
        <button
          key={p.id}
          type="button"
          className="demo-catalog__card"
          onClick={() => onOpen(p.id)}
        >
          <div className="demo-catalog__card-head">
            <span className="demo-catalog__card-icon" aria-hidden>{p.icon}</span>
            <span className="demo-catalog__card-cat">{catId}</span>
          </div>
          <div className="demo-catalog__card-title">{p.label}</div>
          <div className="demo-catalog__card-blurb">{p.blurb}</div>
          <div className="demo-catalog__card-count">{p.chrome === "full" ? "full-screen mockup" : "in-app mockup"}</div>
        </button>
      ))}
    </div>
  );
}
