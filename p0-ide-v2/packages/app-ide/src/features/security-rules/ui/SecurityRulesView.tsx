import { useState } from "react";
import type { RulesTab, SecurityRule } from "@quanta/app-ide/entities/security-rules";
import { MOCK_RULES, MOCK_REGISTRY, MOCK_PACKS } from "@quanta/app-ide/entities/security-rules";
import { cn } from "@quanta/ui-kit/lib";
import { RuleLibrary } from "./RuleLibrary";
import { SourceSinkRegistry } from "./SourceSinkRegistry";
import { PacksGrid } from "./PacksGrid";
import { RuleBuilderPanel } from "./RuleBuilderPanel";
import "./security-rules.css";

const TABS: { key: RulesTab; label: string }[] = [
  { key: "rules", label: "Rules" },
  { key: "registry", label: "Sources & Sinks" },
  { key: "packs", label: "Packs" },
];

export function SecurityRulesView() {
  const [tab, setTab] = useState<RulesTab>("rules");
  const [editingRule, setEditingRule] = useState<SecurityRule | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<number | null>(null);

  const filteredRules = filterSeverity
    ? MOCK_RULES.filter((r) => r.severity === filterSeverity)
    : MOCK_RULES;

  const activeCount = MOCK_RULES.filter((r) => r.active).length;
  const violationTotal = MOCK_RULES.reduce((s, r) => s + r.violationCount, 0);

  return (
    <div className="sr-view">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="sr-header">
        <div className="sr-header__left">
          <svg className="sr-header__icon" width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <h1 className="sr-header__title">Security Rules</h1>
          <div className="sr-header__stats">
            <span className="sr-header__stat">{activeCount} active</span>
            <span className="sr-header__sep" />
            <span className="sr-header__stat">{MOCK_RULES.length} total</span>
            {violationTotal > 0 && (
              <>
                <span className="sr-header__sep" />
                <span className="sr-header__stat sr-header__stat--violations">{violationTotal} violations</span>
              </>
            )}
          </div>
        </div>
        <button className="sr-header__new-btn" type="button" onClick={() => setEditingRule({
          id: "", title: "", description: "", template: "source-to-sink-requires-sanitizer",
          severity: 2, owaspCode: "A03", sourceTags: [], sinkTags: [], guardTags: [],
          scope: ["*"], active: true, violationCount: 0,
        })}>
          + New Rule
        </button>
      </header>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <nav className="sr-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={cn("sr-tabs__btn", tab === t.key && "sr-tabs__btn--active")}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "rules" && (
              <span className="sr-tabs__count">{MOCK_RULES.length}</span>
            )}
            {t.key === "registry" && (
              <span className="sr-tabs__count">{MOCK_REGISTRY.length}</span>
            )}
            {t.key === "packs" && (
              <span className="sr-tabs__count">{MOCK_PACKS.length}</span>
            )}
          </button>
        ))}

        {/* Severity filter (only on rules tab) */}
        {tab === "rules" && (
          <div className="sr-tabs__filters">
            {[3, 2, 1].map((sev) => (
              <button
                key={sev}
                type="button"
                className={cn("sr-filter-chip", filterSeverity === sev && "sr-filter-chip--active",
                  `sr-filter-chip--sev-${sev}`)}
                onClick={() => setFilterSeverity(filterSeverity === sev ? null : sev)}
              >
                {sev === 3 ? "HIGH" : sev === 2 ? "MED" : "LOW"}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <div className="sr-content">
        {tab === "rules" && (
          <RuleLibrary rules={filteredRules} onEditRule={setEditingRule} />
        )}
        {tab === "registry" && (
          <SourceSinkRegistry entries={MOCK_REGISTRY} />
        )}
        {tab === "packs" && (
          <PacksGrid packs={MOCK_PACKS} />
        )}
      </div>

      {/* ── Builder panel (slide-out) ───────────────────────────── */}
      {editingRule && (
        <RuleBuilderPanel
          rule={editingRule}
          onClose={() => setEditingRule(null)}
        />
      )}
    </div>
  );
}
