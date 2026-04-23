import { useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useAutopilot } from "@quanta/app-autopilot/stores";
import {
  Button,
  Chip,
  Kbd,
  SectionHeader,
  Select,
  Stepper,
  TextInput,
} from "@quanta/app-autopilot/shared/ui/primitives";
import { AutonomyLadder, Gauge } from "@quanta/app-autopilot/shared/ui/viz";
import { METRIC_REGISTRY, formatMetricValue } from "@quanta/app-autopilot/entities/metric";
import { targetLabel } from "@quanta/app-autopilot/entities/goal";
import type { ComparisonOp, GoalTarget } from "@quanta/app-autopilot/entities/goal";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";
import "./goal-new-page.css";

export interface GoalNewPageProps {
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}

type StepId = "scope" | "metrics" | "autonomy" | "review";

const STEPS: { id: StepId; label: string }[] = [
  { id: "scope", label: "Scope" },
  { id: "metrics", label: "Metrics & targets" },
  { id: "autonomy", label: "Autonomy" },
  { id: "review", label: "Review" },
];

interface DraftGoal {
  name: string;
  description: string;
  intent: string;
  repoWide: boolean;
  paths: string[];
  pathInput: string;
  targets: Array<Pick<GoalTarget, "metric" | "operator" | "value"> & { narrativeIntent?: string }>;
  autonomyProfile: string;
  mode: "observe" | "suggest" | "enforce";
}

const INITIAL: DraftGoal = {
  name: "",
  description: "",
  intent: "",
  repoWide: true,
  paths: [],
  pathInput: "",
  targets: [{ metric: "", operator: "lte", value: 0 }],
  autonomyProfile: "safe_production",
  mode: "enforce",
};

export function GoalNewPage({ navigate }: GoalNewPageProps) {
  const profiles = useAutopilot((s) => s.autonomyProfiles);
  const [step, setStep] = useState<number>(0);
  const [draft, setDraft] = useState<DraftGoal>(INITIAL);

  const update = useCallback((patch: Partial<DraftGoal>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const canAdvance = useMemo(() => {
    if (step === 0) return draft.name.trim().length > 0 && (draft.repoWide || draft.paths.length > 0);
    if (step === 1) return draft.targets.every((t) => t.metric !== "" && !Number.isNaN(Number(t.value)));
    if (step === 2) return draft.autonomyProfile !== "";
    return true;
  }, [step, draft]);

  const profile = profiles.find((p) => p.id === draft.autonomyProfile);

  const addTarget = () => {
    update({
      targets: [...draft.targets, { metric: "", operator: "lte", value: 0 }],
    });
  };
  const removeTarget = (i: number) => {
    update({ targets: draft.targets.filter((_, idx) => idx !== i) });
  };
  const patchTarget = (i: number, patch: Partial<DraftGoal["targets"][number]>) => {
    update({
      targets: draft.targets.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
    });
  };

  const addPath = () => {
    const p = draft.pathInput.trim();
    if (p.length === 0) return;
    update({ paths: [...draft.paths, p], pathInput: "" });
  };
  const removePath = (i: number) => {
    update({ paths: draft.paths.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="ap-goaln ap-container">
      <SectionHeader
        eyebrow="New goal"
        title="Declare the state autopilot should reach"
        subtitle="Goals are declarative. Planner + operators figure out the path. Metric registry keeps you from targeting something that doesn't exist."
      />

      <div className="ap-goaln__stepper">
        <Stepper steps={STEPS} activeIndex={step} onJump={setStep} />
      </div>

      <div className="ap-goaln__body">
        {step === 0 && (
          <section className="ap-card ap-goaln__step">
            <h2 className="ap-goaln__step-title">What is this goal about?</h2>
            <p className="ap-goaln__step-sub">Name it, write the narrative intent, pick its scope.</p>
            <div className="ap-goaln__fields">
              <TextInput
                id="goal-name"
                label="Name"
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="e.g. Billing — structural health"
                hint="Short. Appears in the Goals index and inbox."
              />
              <TextInput
                id="goal-desc"
                label="One-line description"
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="Why this goal exists"
              />
              <div className="ap-goaln__scope-row">
                <label className="ap-goaln__scope-toggle">
                  <input
                    type="checkbox"
                    checked={draft.repoWide}
                    onChange={(e) => update({ repoWide: e.target.checked })}
                  />
                  <span>Apply repo-wide</span>
                </label>
                {!draft.repoWide && (
                  <div className="ap-goaln__paths">
                    <div className="ap-goaln__paths-row">
                      <TextInput
                        id="goal-path"
                        label="Scope paths"
                        value={draft.pathInput}
                        onChange={(e) => update({ pathInput: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addPath();
                          }
                        }}
                        placeholder="services/billing/**"
                        mono
                        trailing={
                          <Button variant="ghost" size="sm" onClick={addPath} leading={<Plus size={12} strokeWidth={2} aria-hidden />}>
                            Add
                          </Button>
                        }
                        hint="Enter glob patterns. One per line."
                      />
                    </div>
                    {draft.paths.length > 0 && (
                      <ul className="ap-goaln__path-list">
                        {draft.paths.map((p, i) => (
                          <li key={i}>
                            <code className="ap-mono">{p}</code>
                            <button
                              type="button"
                              className="ap-goaln__path-remove"
                              onClick={() => removePath(i)}
                              aria-label={`Remove ${p}`}
                            >
                              <X size={10} strokeWidth={2.2} aria-hidden />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="ap-card ap-goaln__step">
            <h2 className="ap-goaln__step-title">Targets</h2>
            <p className="ap-goaln__step-sub">
              Pick from the metric registry. Autopilot cannot target a metric that doesn't exist.
            </p>
            <ul className="ap-goaln__targets">
              {draft.targets.map((t, i) => {
                const def = METRIC_REGISTRY.find((m) => m.id === t.metric);
                return (
                  <li key={i} className="ap-goaln__target">
                    <div className="ap-goaln__target-head">
                      <span className="ap-goaln__target-idx">T{i + 1}</span>
                      <div className="ap-goaln__target-fields">
                        <Select<string>
                          label="Metric"
                          value={t.metric}
                          onChange={(v) => patchTarget(i, { metric: v })}
                          options={[
                            { value: "", label: "— choose a metric —", disabled: true },
                            ...METRIC_REGISTRY.map((m) => ({
                              value: m.id,
                              label: m.name,
                            })),
                          ]}
                        />
                        <Select<ComparisonOp>
                          label="Op"
                          value={t.operator}
                          onChange={(v) => patchTarget(i, { operator: v })}
                          options={[
                            { value: "lte", label: "≤ at most" },
                            { value: "lt", label: "< less than" },
                            { value: "eq", label: "= equal" },
                            { value: "gte", label: "≥ at least" },
                            { value: "gt", label: "> more than" },
                            { value: "neq", label: "≠ not equal" },
                          ]}
                        />
                        <TextInput
                          label="Value"
                          value={String(t.value)}
                          onChange={(e) => patchTarget(i, { value: e.target.value })}
                          mono
                          placeholder={def ? formatMetricValue(0, def.unit) : "0"}
                        />
                      </div>
                      {draft.targets.length > 1 && (
                        <button
                          type="button"
                          className="ap-goaln__target-remove"
                          onClick={() => removeTarget(i)}
                          aria-label="Remove target"
                        >
                          <X size={12} strokeWidth={2} aria-hidden />
                        </button>
                      )}
                    </div>
                    {def != null && (
                      <div className="ap-goaln__target-info">
                        <Chip tone="muted" mono>{def.unit}</Chip>
                        <Chip tone={def.direction === "lower-better" ? "success" : "accent"}>
                          {def.direction}
                        </Chip>
                        <Chip tone="muted" mono>v{def.version}</Chip>
                        <span className="ap-goaln__target-desc">{def.description}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <Button
              variant="ghost"
              leading={<Plus size={14} strokeWidth={1.8} aria-hidden />}
              onClick={addTarget}
            >
              Add target
            </Button>
          </section>
        )}

        {step === 2 && (
          <section className="ap-card ap-goaln__step">
            <h2 className="ap-goaln__step-title">Autonomy envelope</h2>
            <p className="ap-goaln__step-sub">
              How much autopilot may do on its own. Safer profiles require human checkpoint.
            </p>
            <ul className="ap-goaln__profiles">
              {profiles.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`ap-goaln__profile ${draft.autonomyProfile === p.id ? "is-active" : ""}`}
                    onClick={() => update({ autonomyProfile: p.id })}
                  >
                    <div className="ap-goaln__profile-head">
                      <AutonomyLadder level={p.level} variant="chip" />
                      <span className="ap-goaln__profile-name">{p.name}</span>
                      {draft.autonomyProfile === p.id && (
                        <span className="ap-goaln__profile-selected">
                          <Check size={12} strokeWidth={2.4} aria-hidden />
                        </span>
                      )}
                    </div>
                    <div className="ap-goaln__profile-desc">{p.description}</div>
                    <div className="ap-goaln__profile-tags">
                      {p.allowsAutoPr && <Chip tone="success" mono>auto PR</Chip>}
                      {p.requiresCheckpointReview && <Chip tone="muted" mono>checkpoint</Chip>}
                      {p.allowsContinuousRuns && <Chip tone="accent" mono>continuous</Chip>}
                      {p.allowedRisk.length > 0 ? (
                        p.allowedRisk.map((r) => <Chip key={r} tone="muted">risk · {r}</Chip>)
                      ) : (
                        <Chip tone="muted">no mutation</Chip>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <div className="ap-goaln__mode">
              <Select<"observe" | "suggest" | "enforce">
                label="Evaluation mode"
                value={draft.mode}
                onChange={(v) => update({ mode: v })}
                options={[
                  { value: "observe", label: "observe · track drift only" },
                  { value: "suggest", label: "suggest · surface work, no execution" },
                  { value: "enforce", label: "enforce · reconcile toward target" },
                ]}
                hint="Changes how the goal interacts with the planner."
              />
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="ap-card ap-goaln__step">
            <h2 className="ap-goaln__step-title">
              <Sparkles size={16} strokeWidth={1.8} aria-hidden style={{ marginRight: 6, verticalAlign: "-2px" }} />
              Review & file
            </h2>
            <p className="ap-goaln__step-sub">
              Autopilot will persist this to <code className="ap-mono">.quanta/goals/{(draft.name || "new-goal").toLowerCase().replace(/\s+/g, "-")}.yaml</code>.
              You can still edit it afterward.
            </p>

            <div className="ap-goaln__review">
              <div className="ap-goaln__review-card">
                <div className="ap-goaln__review-eyebrow">
                  <Target size={12} strokeWidth={2} aria-hidden /> GOAL
                </div>
                <div className="ap-goaln__review-title">{draft.name || "(unnamed goal)"}</div>
                {draft.description && <div className="ap-goaln__review-desc">{draft.description}</div>}
                <div className="ap-goaln__review-meta">
                  <Chip tone="muted">
                    {draft.repoWide ? "repo-wide" : `${draft.paths.length} paths`}
                  </Chip>
                  <Chip tone={draft.mode === "enforce" ? "accent" : "muted"}>{draft.mode}</Chip>
                  {profile != null && <Chip tone="muted" mono>{profile.name}</Chip>}
                </div>
              </div>

              <div className="ap-goaln__review-card">
                <div className="ap-goaln__review-eyebrow">TARGETS</div>
                <ul className="ap-goaln__review-targets">
                  {draft.targets.map((t, i) => {
                    const def = METRIC_REGISTRY.find((m) => m.id === t.metric);
                    return (
                      <li key={i}>
                        <span className="ap-goaln__review-target-name">
                          {def?.name ?? t.metric ?? "(choose)"}
                        </span>
                        <span className="ap-goaln__review-target-rule">
                          {targetLabel(t.operator)} <span className="ap-mono">{String(t.value)}</span>
                        </span>
                        <Gauge progress={0} tone="neutral" variant="bar" />
                      </li>
                    );
                  })}
                </ul>
              </div>

              {profile != null && (
                <div className="ap-goaln__review-card">
                  <div className="ap-goaln__review-eyebrow">AUTONOMY</div>
                  <AutonomyLadder level={profile.level} />
                  <div className="ap-goaln__review-desc">{profile.description}</div>
                </div>
              )}

              {!draft.repoWide && draft.paths.length > 0 && (
                <div className="ap-goaln__review-card">
                  <div className="ap-goaln__review-eyebrow">SCOPE PATHS</div>
                  <ul className="ap-goaln__review-paths">
                    {draft.paths.map((p) => (
                      <li key={p}><code className="ap-mono">{p}</code></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <footer className="ap-goaln__foot">
        <Button
          variant="ghost"
          leading={<ArrowLeft size={13} strokeWidth={1.8} aria-hidden />}
          onClick={() => (step > 0 ? setStep(step - 1) : navigate({ page: "goals" }))}
        >
          {step > 0 ? "Back" : "Cancel"}
        </Button>
        <span className="ap-goaln__foot-step">
          Step {step + 1} / {STEPS.length}
        </span>
        {step < STEPS.length - 1 ? (
          <Button
            variant="primary"
            trailing={<ArrowRight size={13} strokeWidth={1.8} aria-hidden />}
            onClick={() => setStep(step + 1)}
            disabled={!canAdvance}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="primary"
            leading={<Check size={13} strokeWidth={2} aria-hidden />}
            onClick={() => navigate({ page: "goals" })}
          >
            File goal
          </Button>
        )}
      </footer>
      <div className="ap-goaln__hint">
        <Kbd>Esc</Kbd> cancel
      </div>
    </div>
  );
}
