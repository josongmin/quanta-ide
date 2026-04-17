import { cn } from "@quanta/ui-kit/lib";
import type { SidebarItem } from "@quanta/domain-types/policies";
import { policyStore, usePolicyStore } from "@quanta/app-policy/entities/policy";

interface NavEntry {
  id: SidebarItem;
  label: string;
  enabled: boolean;
}

const NAV_ITEMS: NavEntry[] = [
  { id: "overview", label: "Overview", enabled: false },
  { id: "rule-catalog", label: "Rule Catalog", enabled: true },
  { id: "rule-sets", label: "Rule Sets", enabled: false },
  { id: "authoring", label: "Authoring", enabled: true },
  { id: "validation", label: "Validation", enabled: false },
  { id: "engines", label: "Policies / Engines", enabled: false },
  { id: "pr-enforcement", label: "PR Enforcement", enabled: false },
  { id: "alerts-triage", label: "Alerts & Triage", enabled: true },
  { id: "exceptions", label: "Exceptions", enabled: false },
  { id: "governance", label: "Governance", enabled: false },
];

export function PolicySidebar() {
  const active = usePolicyStore((s) => s.activeSidebarItem);

  return (
    <aside className="pol-sidebar" aria-label="Policy Studio navigation">
      {/* Header */}
      <div className="pol-sidebar__header">
        <span className="pol-sidebar__kicker">Policy Studio</span>
        <p className="pol-sidebar__desc">
          CodeQL, Semgrep 등을 합쳐서 다 커버하는 통합 엔지니어링 + 보안 관리 공간
        </p>
      </div>

      {/* Navigation */}
      <nav className="pol-sidebar__nav">
        {NAV_ITEMS.map((item) => (
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
            {item.label}
          </button>
        ))}
      </nav>

      {/* Active Rule Sets */}
      <div className="pol-sidebar__section">
        <span className="pol-sidebar__section-label">Active Rule Sets</span>
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
