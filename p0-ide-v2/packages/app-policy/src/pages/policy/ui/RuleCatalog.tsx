import { cn } from "@quanta/ui-kit/lib";
import type { EngineType } from "@quanta/domain-types/policies";
import { ENGINE_LABEL } from "@quanta/domain-types/policies";
import { policyStore, usePolicyStore } from "@quanta/app-policy/entities/policy";
import { CategoryCards } from "./CategoryCards";
import { RuleListItem } from "./RuleListItem";
import { RuleDetailPane } from "./RuleDetailPane";

const ENGINE_OPTIONS: (EngineType | "all")[] = ["all", "codeql", "taint-engine", "semgrep", "custom", "hybrid"];

function engineLabel(e: EngineType | "all") {
  return e === "all" ? "All" : ENGINE_LABEL[e];
}

export function RuleCatalog() {
  const selectedRuleId = usePolicyStore((s) => s.selectedRuleId);
  const engineFilter = usePolicyStore((s) => s.filters.engine);
  const searchQuery = usePolicyStore((s) => s.filters.searchQuery);
  const rules = policyStore.filteredRules();
  const selectedRule = rules.find((r) => r.id === selectedRuleId) ?? null;

  return (
    <div className="pol-catalog">
      {/* Header */}
      <header className="pol-catalog__header">
        <div className="pol-catalog__header-left">
          <span className="pol-catalog__kicker">Rule Catalog</span>
          <span className="pol-catalog__title">Security / Policy Rule Management</span>
        </div>
        <div className="pol-catalog__actions">
          <input
            className="pol-catalog__search"
            placeholder="Search rules, tags..."
            value={searchQuery}
            onChange={(e) => policyStore.setSearchQuery(e.target.value)}
          />
          <button
            type="button"
            className="pol-btn pol-btn--ghost"
            onClick={() => policyStore.startNewRule()}
          >
            Import Pack
          </button>
          <button
            type="button"
            className="pol-btn pol-btn--primary"
            onClick={() => policyStore.startNewRule()}
          >
            New Rule
          </button>
        </div>
      </header>

      {/* Category cards */}
      <CategoryCards />

      {/* Engine filter pills */}
      <div className="pol-engine-filters">
        {ENGINE_OPTIONS.map((e) => (
          <button
            key={e}
            type="button"
            className={cn("pol-pill", engineFilter === e && "is-active")}
            onClick={() => policyStore.setEngineFilter(e)}
          >
            {engineLabel(e)}
          </button>
        ))}
      </div>

      {/* Split: list + detail */}
      <div className="pol-split">
        <div className="pol-split__list">
          {rules.length === 0 ? (
            <div className="pol-split__empty">No rules match filters</div>
          ) : (
            rules.map((rule) => (
              <RuleListItem key={rule.id} rule={rule} isSelected={rule.id === selectedRuleId} />
            ))
          )}
        </div>
        {selectedRule ? (
          <RuleDetailPane rule={selectedRule} />
        ) : (
          <div className="pol-split__empty">Select a rule to view details</div>
        )}
      </div>
    </div>
  );
}
