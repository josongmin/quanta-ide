import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@quanta/ui-kit/lib";
import { CATEGORIES, DEMO_PAGES, pagesByCategory } from "../demo-registry";

export interface DemoSidebarProps {
  pageId: string;
  onSelect: (id: string) => void;
}

export function DemoSidebar({ pageId, onSelect }: DemoSidebarProps) {
  const [query, setQuery] = useState("");

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

  return (
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
                  onClick={() => onSelect(p.id)}
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
  );
}
