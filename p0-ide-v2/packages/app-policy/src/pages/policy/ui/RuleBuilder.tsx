import type { PolicyCategory, PolicySeverity, PolicyScope, PolicyTemplateId, EngineType } from "@quanta/domain-types/policies";
import { CATEGORY_LABEL, SEVERITY_LABEL, ENGINE_LABEL } from "@quanta/domain-types/policies";
import { policyStore, usePolicyStore } from "@quanta/app-policy/entities/policy";
import { TemplatePickerStrip } from "./TemplatePickerStrip";
import { ScopeInput } from "./ScopeInput";

const CATEGORIES: PolicyCategory[] = ["security", "architecture", "reliability", "data-privacy", "team-rules"];
const SEVERITIES: PolicySeverity[] = ["critical", "high", "medium", "low"];
const ENGINES: EngineType[] = ["codeql", "taint-engine", "semgrep", "custom", "hybrid"];

export function RuleBuilder() {
  const draft = usePolicyStore((s) => s.draft);

  if (!draft) {
    return (
      <div className="pol-builder" style={{ alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--fg-subtle)" }}>No draft in progress.</p>
        <button
          type="button"
          className="pol-btn pol-btn--primary"
          onClick={() => policyStore.startNewRule()}
        >
          Start new rule
        </button>
      </div>
    );
  }

  const update = policyStore.updateDraft.bind(policyStore);

  return (
    <>
      <TemplatePickerStrip
        activeId={draft.templateId}
        onPick={(id: PolicyTemplateId) => update({ templateId: id })}
      />

      <div className="pol-builder">
        {/* Name */}
        <div className="pol-builder__field">
          <label className="pol-builder__field-label">Rule name</label>
          <input
            className="pol-builder__input"
            placeholder="e.g. No domain layer importing infra"
            value={draft.name ?? ""}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>

        {/* Description */}
        <div className="pol-builder__field">
          <label className="pol-builder__field-label">Description</label>
          <textarea
            className="pol-builder__input pol-builder__textarea"
            placeholder="Why this rule exists and what it prevents"
            value={draft.description ?? ""}
            onChange={(e) => update({ description: e.target.value })}
          />
        </div>

        {/* Category */}
        <div className="pol-builder__field">
          <label className="pol-builder__field-label">Category</label>
          <select
            className="pol-builder__select"
            value={draft.category ?? "architecture"}
            onChange={(e) => update({ category: e.target.value as PolicyCategory })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        </div>

        {/* Severity */}
        <div className="pol-builder__field">
          <label className="pol-builder__field-label">Severity</label>
          <select
            className="pol-builder__select"
            value={draft.severity ?? "medium"}
            onChange={(e) => update({ severity: e.target.value as PolicySeverity })}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>
            ))}
          </select>
        </div>

        {/* Engine */}
        <div className="pol-builder__field">
          <label className="pol-builder__field-label">Engine</label>
          <select
            className="pol-builder__select"
            value={draft.engine ?? "custom"}
            onChange={(e) => update({ engine: e.target.value as EngineType })}
          >
            {ENGINES.map((eng) => (
              <option key={eng} value={eng}>{ENGINE_LABEL[eng]}</option>
            ))}
          </select>
        </div>

        {/* Constraint */}
        <div className="pol-builder__field">
          <label className="pol-builder__field-label">Constraint</label>
          <div className="pol-builder__radio-group">
            <label>
              <input
                type="radio"
                name="constraint"
                checked={draft.constraint === "deny"}
                onChange={() => update({ constraint: "deny" })}
              />
              Deny
            </label>
            <label>
              <input
                type="radio"
                name="constraint"
                checked={draft.constraint === "allow"}
                onChange={() => update({ constraint: "allow" })}
              />
              Allow
            </label>
          </div>
        </div>

        {/* Source scope */}
        <ScopeInput
          label="Source scope"
          scope={draft.sourceScope ?? {}}
          onChange={(sourceScope: PolicyScope) => update({ sourceScope })}
        />

        {/* Target scope */}
        <ScopeInput
          label="Target scope"
          scope={draft.targetScope ?? {}}
          onChange={(targetScope: PolicyScope) => update({ targetScope })}
        />

        {/* Owner */}
        <div className="pol-builder__field">
          <label className="pol-builder__field-label">Owner</label>
          <input
            className="pol-builder__input"
            placeholder="e.g. platform-team"
            value={draft.owner ?? ""}
            onChange={(e) => update({ owner: e.target.value })}
          />
        </div>

        {/* PR gate */}
        <div className="pol-builder__toggle-row">
          <input
            type="checkbox"
            id="prGate"
            checked={draft.prGateEnabled ?? false}
            onChange={(e) => update({ prGateEnabled: e.target.checked })}
          />
          <label htmlFor="prGate">Enable PR gate (block merge on violation)</label>
        </div>

        {/* Actions */}
        <div className="pol-builder__actions">
          <button
            type="button"
            className="pol-btn pol-btn--primary"
            disabled={!draft.name?.trim()}
            onClick={() => policyStore.saveDraft()}
          >
            Save rule
          </button>
          <button
            type="button"
            className="pol-btn pol-btn--ghost"
            onClick={() => policyStore.discardDraft()}
          >
            Discard
          </button>
        </div>
      </div>
    </>
  );
}
