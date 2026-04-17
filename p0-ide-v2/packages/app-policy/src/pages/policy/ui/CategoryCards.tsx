import { cn } from "@quanta/ui-kit/lib";
import type { PolicyCategory } from "@quanta/domain-types/policies";
import { CATEGORY_LABEL, CATEGORY_DESC } from "@quanta/domain-types/policies";
import { policyStore, usePolicyStore } from "@quanta/app-policy/entities/policy";

const CATEGORIES: (PolicyCategory | "all")[] = [
  "security", "architecture", "reliability", "data-privacy", "team-rules",
];

export function CategoryCards() {
  const activeCategory = usePolicyStore((s) => s.filters.category);
  const counts = policyStore.categoryCounts();

  return (
    <div className="pol-cat-cards">
      {CATEGORIES.map((cat) => {
        const count = counts[cat] ?? 0;
        const label = cat === "all" ? "All" : CATEGORY_LABEL[cat];
        const desc = cat === "all" ? undefined : CATEGORY_DESC[cat];
        return (
          <button
            key={cat}
            type="button"
            className={cn("pol-cat-card", activeCategory === cat && "is-active")}
            onClick={() => policyStore.setCategoryFilter(cat)}
          >
            <span className="pol-cat-card__count">{count}</span>
            <span className="pol-cat-card__label">{label}</span>
            {desc && <span className="pol-cat-card__desc">{desc}</span>}
          </button>
        );
      })}
    </div>
  );
}
