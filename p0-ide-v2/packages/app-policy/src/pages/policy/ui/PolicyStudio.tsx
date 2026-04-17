import { usePolicyStore } from "@quanta/app-policy/entities/policy";
import { PolicySidebar } from "./PolicySidebar";
import { RuleCatalog } from "./RuleCatalog";
import { RuleBuilder } from "./RuleBuilder";
import { AlertsTriage } from "./AlertsTriage";
import { HeroPolicyParticles } from "./HeroPolicyParticles";
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
    <div className="pol-page">
      <div className="pol-shell">
        {/* Hero */}
        <header className="pol-hero">
          <HeroPolicyParticles />
          <div className="pol-hero__content">
            <div className="pol-hero__kicker">Policy Studio</div>
            <h1 className="pol-hero__title">
              Define, enforce, <span className="pol-hero__accent">govern.</span>
            </h1>
            <p className="pol-hero__sub">
              Security rules, architecture constraints, and team policies in one place.
              Every rule is queryable, every violation is traceable.
            </p>
          </div>
        </header>

        {/* Body: sidebar + content */}
        <div className="pol-body-grid">
          <PolicySidebar />
          <div className="pol-studio__main">
            {renderCenter()}
          </div>
        </div>
      </div>
    </div>
  );
}
