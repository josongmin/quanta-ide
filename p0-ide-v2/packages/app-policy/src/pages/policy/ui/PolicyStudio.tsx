import { usePolicyStore } from "@quanta/app-policy/entities/policy";
import { PolicySidebar } from "./PolicySidebar";
import { RuleCatalog } from "./RuleCatalog";
import { RuleBuilder } from "./RuleBuilder";
import { AlertsTriage } from "./AlertsTriage";
import "./policy-page.css";

function PlaceholderView({ label }: { label: string }) {
  return (
    <div className="pol-placeholder">
      <span className="pol-placeholder__label">{label}</span>
      <span className="pol-placeholder__hint">Coming in Phase 2</span>
    </div>
  );
}

export function PolicyStudio() {
  const activeSidebarItem = usePolicyStore((s) => s.activeSidebarItem);

  const renderCenter = () => {
    switch (activeSidebarItem) {
      case "rule-catalog":
        return <RuleCatalog />;
      case "authoring":
        return <RuleBuilder />;
      case "alerts-triage":
        return <AlertsTriage />;
      default:
        return <PlaceholderView label={activeSidebarItem} />;
    }
  };

  return (
    <div className="pol-studio">
      <PolicySidebar />
      <div className="pol-studio__main">
        {renderCenter()}
      </div>
    </div>
  );
}
