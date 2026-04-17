import { cn } from "@quanta/ui-kit/lib";
import type { SidebarItem } from "@quanta/domain-types/policies";
import { policyStore, usePolicyStore } from "@quanta/app-policy/entities/policy";

interface NavSection {
  label: string;
  items: { id: SidebarItem; label: string; count?: number; enabled: boolean }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Catalog",
    items: [
      { id: "rule-catalog", label: "All rules", enabled: true },
      { id: "alerts-triage", label: "Alerts & Triage", enabled: true },
    ],
  },
  {
    label: "Authoring",
    items: [
      { id: "authoring", label: "Rule builder", enabled: true },
      { id: "rule-sets", label: "Rule sets", enabled: false },
      { id: "validation", label: "Validation", enabled: false },
    ],
  },
  {
    label: "Governance",
    items: [
      { id: "pr-enforcement", label: "PR enforcement", enabled: false },
      { id: "engines", label: "Engines", enabled: false },
      { id: "exceptions", label: "Exceptions", enabled: false },
      { id: "governance", label: "Audit log", enabled: false },
    ],
  },
];

export function PolicySidebar() {
  const active = usePolicyStore((s) => s.activeSidebarItem);
  const stats = policyStore.stats();

  function countFor(id: SidebarItem): number | undefined {
    if (id === "rule-catalog") return stats.totalRules;
    if (id === "alerts-triage") return stats.openViolations;
    return undefined;
  }

  return (
    <aside className="pol-sidebar" aria-label="Policy Studio navigation">
      <div className="pol-sidebar__header">
        <span className="pol-sidebar__kicker">Policy Studio</span>
      </div>

      <nav className="pol-sidebar__nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="pol-sidebar__group">
            <span className="pol-sidebar__group-label">{section.label}</span>
            {section.items.map((item) => {
              const count = countFor(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "pol-sidebar__item",
                    item.id === active && "is-active",
                    !item.enabled && "is-disabled",
                  )}
                  onClick={() => item.enabled && policyStore.setSidebarItem(item.id)}
                  disabled={!item.enabled}
                >
                  <span className="pol-sidebar__item-label">{item.label}</span>
                  {count != null && <span className="pol-sidebar__item-count">{count}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="pol-sidebar__footer">
        <div className="pol-sidebar__ruleset">
          <span className="pol-sidebar__ruleset-name">Global Secure Engineering Baseline</span>
          <span className="pol-sidebar__ruleset-meta">Org 기준 적용</span>
        </div>
        <div className="pol-sidebar__ruleset">
          <span className="pol-sidebar__ruleset-name">Checkout/Payment Guard</span>
          <span className="pol-sidebar__ruleset-meta">Org 1팀 전용</span>
        </div>
      </div>
    </aside>
  );
}
