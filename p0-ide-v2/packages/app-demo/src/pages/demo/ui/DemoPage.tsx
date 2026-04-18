import { createContext, useContext, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { cn } from "@quanta/ui-kit/lib";
import { CATEGORIES, DEMO_PAGES, findPage, pagesByCategory, type DemoPageMeta } from "./demo-registry";
import "./demo-page.css";

export interface DemoNavCtx {
  navigate: (id: string) => void;
}

const DemoNavContext = createContext<DemoNavCtx>({ navigate: () => {} });

export function useDemoNav(): DemoNavCtx {
  return useContext(DemoNavContext);
}

export function DemoPage() {
  const [pageId, setPageId] = useState<string>("catalog");
  const [query, setQuery] = useState("");

  const current = findPage(pageId);

  const filteredBuckets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORIES.map((c) => {
      const pages = pagesByCategory(c.id).filter(
        (p) =>
          !q ||
          p.label.toLowerCase().includes(q) ||
          p.blurb.toLowerCase().includes(q) ||
          c.label.toLowerCase().includes(q),
      );
      return { category: c, pages };
    }).filter((b) => b.pages.length > 0);
  }, [query]);

  const navCtx = useMemo<DemoNavCtx>(() => ({ navigate: setPageId }), []);

  return (
    <div className="demo-page">
      <aside className="demo-nav">
        <div className="demo-nav__header">
          <div className="demo-nav__kicker">Try demo</div>
          <div className="demo-nav__title">SaaS surfaces</div>
        </div>

        <div className="demo-nav__search">
          <Search size={13} strokeWidth={2} aria-hidden />
          <input
            type="search"
            placeholder="Filter screens"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="demo-nav__scroll">
          {filteredBuckets.map(({ category, pages }) => (
            <div key={category.id} className="demo-nav__group">
              <div className="demo-nav__group-label">
                <span className="demo-nav__group-icon" aria-hidden>{category.icon}</span>
                <span>{category.label}</span>
                <span className="demo-nav__group-count">{pages.length}</span>
              </div>
              <div className="demo-nav__list">
                {pages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={cn("demo-nav__item", pageId === p.id && "is-active")}
                    onClick={() => setPageId(p.id)}
                    title={p.blurb}
                  >
                    <span className="demo-nav__item-icon" aria-hidden>{p.icon}</span>
                    <span className="demo-nav__item-label">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filteredBuckets.length === 0 && (
            <div className="demo-nav__empty">No screens match &ldquo;{query}&rdquo;.</div>
          )}
        </div>

        <div className="demo-nav__footer">
          <span className="demo-nav__footer-dot" aria-hidden />
          {DEMO_PAGES.length} mockups — not wired to a backend.
        </div>
      </aside>

      <main className="demo-main">
        <header className="demo-crumbs">
          <button
            type="button"
            className="demo-crumbs__root"
            onClick={() => setPageId("catalog")}
          >
            Try demo
          </button>
          <ChevronRight size={13} strokeWidth={1.8} className="demo-crumbs__sep" aria-hidden />
          <span className="demo-crumbs__cat">
            {CATEGORIES.find((c) => c.id === current.category)?.label}
          </span>
          {current.id !== "catalog" && (
            <>
              <ChevronRight size={13} strokeWidth={1.8} className="demo-crumbs__sep" aria-hidden />
              <span className="demo-crumbs__current">{current.label}</span>
            </>
          )}
          <span className="demo-crumbs__spacer" />
          <span className="demo-crumbs__tag">Preview</span>
        </header>

        <PageStage page={current} ctx={navCtx} />
      </main>
    </div>
  );
}

function PageStage({ page, ctx }: { page: DemoPageMeta; ctx: DemoNavCtx }) {
  return (
    <div className={cn("demo-stage", `demo-stage--${page.chrome}`)}>
      <div className="demo-stage__inner">
        <DemoNavContext.Provider value={ctx}>
          <page.Component />
        </DemoNavContext.Provider>
      </div>
    </div>
  );
}
