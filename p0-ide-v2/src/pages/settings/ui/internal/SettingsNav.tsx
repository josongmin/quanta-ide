import type { ReactNode } from "react";
import { cn } from "@/shared/lib";
import type { CategoryId } from "../settings-page.data";
import {
  ALL_ICON,
  CATEGORY_ICON,
  CATEGORY_LABEL,
  NAV_GROUPS,
} from "../settings-page.data";

export function SettingsNav({
  selected,
  counts,
  onSelect,
  onReset,
}: {
  selected: CategoryId;
  counts: Record<CategoryId, number>;
  onSelect: (id: CategoryId) => void;
  onReset: () => void;
}) {
  return (
    <aside className="settings-nav">
      <div className="settings-nav__sticky">
        <nav className="settings-nav__list" role="tablist" aria-label="Setting categories">
          <div className="settings-nav__group">
            <div className="settings-nav__section">Workspace</div>
            <CategoryLink
              id="all"
              label="All features"
              icon={ALL_ICON}
              count={counts.all}
              selected={selected === "all"}
              onSelect={() => onSelect("all")}
            />
          </div>
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="settings-nav__group">
              <div className="settings-nav__section">{group.label}</div>
              {group.items.map((c) => (
                <CategoryLink
                  key={c}
                  id={c}
                  label={CATEGORY_LABEL[c]}
                  icon={CATEGORY_ICON[c]}
                  count={counts[c]}
                  selected={selected === c}
                  onSelect={() => onSelect(c)}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="settings-nav__foot">
          <button type="button" className="settings-nav__reset" onClick={onReset}>
            Reset all to defaults
          </button>
        </div>
      </div>
    </aside>
  );
}

function CategoryLink({
  id,
  label,
  icon,
  count,
  selected,
  onSelect,
}: {
  id: CategoryId;
  label: string;
  icon: ReactNode;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={cn("settings-nav__item", selected && "is-selected")}
      onClick={onSelect}
      data-id={id}
    >
      <span className="settings-nav__icon" aria-hidden>{icon}</span>
      <span className="settings-nav__label">{label}</span>
      <span className="settings-nav__count">{count}</span>
    </button>
  );
}
