import { useState } from "react";
import type { SecurityRule, OwaspCode, RuleTemplate } from "@quanta/app-ide/entities/security-rules";
import { OWASP_TITLES, RULE_TEMPLATE_LABELS } from "@quanta/app-ide/entities/security-rules";
import { cn } from "@quanta/ui-kit/lib";

interface Props {
  rule: SecurityRule;
  onClose: () => void;
}

const TEMPLATES: RuleTemplate[] = [
  "source-to-sink-forbidden",
  "source-to-sink-requires-sanitizer",
  "privileged-action-requires-guard",
  "sensitive-data-no-log",
  "external-fetch-requires-allowlist",
  "custom",
];

const OWASP_CODES: OwaspCode[] = ["A01","A02","A03","A04","A05","A06","A07","A08","A09","A10"];

export function RuleBuilderPanel({ rule, onClose }: Props) {
  const [form, setForm] = useState(rule);
  const isNew = !rule.id;

  const set = <K extends keyof SecurityRule>(key: K, value: SecurityRule[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Preview counts (mock)
  const previewViolations = form.active ? Math.floor(Math.random() * 15) + 1 : 0;

  return (
    <>
      <div className="sr-builder-overlay" onClick={onClose} />
      <aside className="sr-builder">
        <header className="sr-builder__header">
          <h2 className="sr-builder__title">{isNew ? "New Rule" : "Edit Rule"}</h2>
          <button className="sr-builder__close" type="button" onClick={onClose} title="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="sr-builder__body">
          {/* Template */}
          <div className="sr-field">
            <label className="sr-field__label">Template</label>
            <select className="sr-field__select" value={form.template}
              onChange={(e) => set("template", e.target.value as RuleTemplate)}>
              {TEMPLATES.map((t) => (
                <option key={t} value={t}>{RULE_TEMPLATE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="sr-field">
            <label className="sr-field__label">Title</label>
            <input className="sr-field__input" value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. No raw SQL from HTTP input" />
          </div>

          {/* Description */}
          <div className="sr-field">
            <label className="sr-field__label">Description</label>
            <textarea className="sr-field__textarea" value={form.description}
              onChange={(e) => set("description", e.target.value)} rows={2}
              placeholder="Explain what this rule enforces and why." />
          </div>

          {/* Severity + OWASP row */}
          <div className="sr-field-row">
            <div className="sr-field sr-field--half">
              <label className="sr-field__label">Severity</label>
              <div className="sr-severity-pick">
                {([3, 2, 1] as const).map((s) => (
                  <button key={s} type="button"
                    className={cn("sr-severity-pick__btn", `sr-severity-pick__btn--${s}`,
                      form.severity === s && "sr-severity-pick__btn--selected")}
                    onClick={() => set("severity", s)}>
                    {s === 3 ? "HIGH" : s === 2 ? "MED" : "LOW"}
                  </button>
                ))}
              </div>
            </div>
            <div className="sr-field sr-field--half">
              <label className="sr-field__label">OWASP</label>
              <select className="sr-field__select" value={form.owaspCode}
                onChange={(e) => set("owaspCode", e.target.value as OwaspCode)}>
                {OWASP_CODES.map((c) => (
                  <option key={c} value={c}>{c} — {OWASP_TITLES[c]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Source tags */}
          <div className="sr-field">
            <label className="sr-field__label">Source tags</label>
            <input className="sr-field__input" value={form.sourceTags.join(", ")}
              onChange={(e) => set("sourceTags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              placeholder="http-input, file-upload" />
            <span className="sr-field__hint">Tags from the Source/Sink Registry</span>
          </div>

          {/* Sink tags */}
          <div className="sr-field">
            <label className="sr-field__label">Sink tags</label>
            <input className="sr-field__input" value={form.sinkTags.join(", ")}
              onChange={(e) => set("sinkTags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              placeholder="sql-exec, html-render" />
          </div>

          {/* Guard tags */}
          <div className="sr-field">
            <label className="sr-field__label">Required guard / sanitizer</label>
            <input className="sr-field__input" value={form.guardTags.join(", ")}
              onChange={(e) => set("guardTags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              placeholder="sql-parameterize, html-escape" />
          </div>

          {/* Scope */}
          <div className="sr-field">
            <label className="sr-field__label">Scope (services)</label>
            <input className="sr-field__input" value={form.scope.join(", ")}
              onChange={(e) => set("scope", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              placeholder="api-*, web-*, or * for all" />
          </div>

          {/* Fix hint */}
          <div className="sr-field">
            <label className="sr-field__label">Fix hint</label>
            <input className="sr-field__input" value={form.fixHint ?? ""}
              onChange={(e) => set("fixHint", e.target.value || undefined)}
              placeholder="Suggested remediation pattern" />
          </div>

          {/* Preview */}
          <div className="sr-builder__preview">
            <div className="sr-builder__preview-label">Preview</div>
            <div className="sr-builder__preview-row">
              <span className="sr-builder__preview-key">Estimated violations</span>
              <span className={cn("sr-builder__preview-val",
                previewViolations > 5 && "sr-builder__preview-val--warn")}>
                {previewViolations}
              </span>
            </div>
            <div className="sr-builder__preview-row">
              <span className="sr-builder__preview-key">Affected services</span>
              <span className="sr-builder__preview-val">{form.scope.join(", ")}</span>
            </div>
            <div className="sr-builder__preview-example">
              <code>
                {form.template === "source-to-sink-forbidden"
                  ? `DENY flow: ${form.sourceTags[0] ?? "?"} → ${form.sinkTags[0] ?? "?"}`
                  : `REQUIRE ${form.guardTags[0] ?? "guard"} on: ${form.sourceTags[0] ?? "?"} → ${form.sinkTags[0] ?? "?"}`}
              </code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="sr-builder__footer">
          <button className="sr-builder__btn sr-builder__btn--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="sr-builder__btn sr-builder__btn--primary" type="button" onClick={onClose}>
            {isNew ? "Create Rule" : "Save Changes"}
          </button>
        </footer>
      </aside>
    </>
  );
}
