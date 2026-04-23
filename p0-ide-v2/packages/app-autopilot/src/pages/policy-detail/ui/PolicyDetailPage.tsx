import { useMemo, useState } from "react";
import { Copy, Eye, FileCode2, FileLock2, ShieldCheck } from "lucide-react";
import { useAutopilot } from "@quanta/app-autopilot/stores";
import { Button, Chip, Kbd } from "@quanta/app-autopilot/shared/ui/primitives";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";
import { relativeTime } from "@quanta/app-autopilot/shared/lib";
import type { EngineeringPolicy } from "@quanta/app-autopilot/entities/policy";
import "./policy-detail-page.css";

export interface PolicyDetailPageProps {
  policyId: string;
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}

type Mode = "structured" | "yaml";

export function PolicyDetailPage({ policyId, navigate }: PolicyDetailPageProps) {
  const policy = useAutopilot((s) => s.policies.find((p) => p.id === policyId));
  const [mode, setMode] = useState<Mode>("structured");

  const yaml = useMemo(() => (policy ? serializeYaml(policy) : ""), [policy]);

  if (!policy) {
    return (
      <div className="ap-empty">
        <div className="ap-empty__title">Policy not found.</div>
        <button type="button" className="ap-linklike" onClick={() => navigate({ page: "policies" })}>
          Back to policies
        </button>
      </div>
    );
  }

  return (
    <div className="ap-pold ap-container">
      <header className="ap-detail-head">
        <div className="ap-detail-head__text">
          <div className="ap-pold__eyebrow">
            <FileLock2 size={12} strokeWidth={2} aria-hidden />
            <span>POLICY</span>
          </div>
          <h1 className="ap-detail-head__title">{policy.name}</h1>
          <p className="ap-detail-head__sub">
            Canonical source: <code className="ap-mono">.quanta/policies/{policy.id}.yaml</code>.
            Applied to any goal whose scope intersects this policy's scope.
          </p>
          <div className="ap-pold__meta">
            <Chip tone="muted" mono>{policy.id}</Chip>
            <Chip tone="muted">{policy.scope.repo ? "repo-wide" : `${policy.scope.paths?.length ?? 0} paths`}</Chip>
            <Chip tone="muted">max risk · {policy.riskPolicy.maxRisk}</Chip>
            <Chip tone="muted">updated {relativeTime(policy.updatedAt)}</Chip>
          </div>
        </div>
        <div className="ap-detail-head__actions">
          <div className="ap-seg" role="tablist" aria-label="View mode">
            <button
              role="tab"
              aria-selected={mode === "structured"}
              className={mode === "structured" ? "ap-seg__btn is-active" : "ap-seg__btn"}
              onClick={() => setMode("structured")}
            >
              <Eye size={12} strokeWidth={1.8} aria-hidden style={{ marginRight: 4 }} />
              Structured
            </button>
            <button
              role="tab"
              aria-selected={mode === "yaml"}
              className={mode === "yaml" ? "ap-seg__btn is-active" : "ap-seg__btn"}
              onClick={() => setMode("yaml")}
            >
              <FileCode2 size={12} strokeWidth={1.8} aria-hidden style={{ marginRight: 4 }} />
              YAML
            </button>
          </div>
          {mode === "yaml" && (
            <Button
              variant="ghost"
              leading={<Copy size={13} strokeWidth={1.8} aria-hidden />}
              onClick={() => navigator.clipboard?.writeText(yaml)}
            >
              Copy
            </Button>
          )}
        </div>
      </header>

      {mode === "structured" ? (
        <div className="ap-pold__body">
          <section className="ap-card">
            <div className="ap-card__head">
              <div>
                <div className="ap-card__eyebrow">Protected zones</div>
                <div className="ap-card__title">
                  {policy.protectedZones.length} path
                  {policy.protectedZones.length === 1 ? "" : "s"} autopilot may not touch
                </div>
              </div>
            </div>
            {policy.protectedZones.length === 0 ? (
              <div className="ap-empty">
                <div className="ap-empty__title">No protected zones.</div>
              </div>
            ) : (
              <ul className="ap-pold__zones">
                {policy.protectedZones.map((z, i) => (
                  <li
                    key={i}
                    className={`ap-pold__zone ap-pold__zone--${z.mode}`}
                  >
                    <div className="ap-pold__zone-mode">
                      <ShieldCheck size={12} strokeWidth={2} aria-hidden />
                      {z.mode === "read_only" ? "read-only" : "approval required"}
                    </div>
                    <code className="ap-mono ap-pold__zone-path">{z.path}</code>
                    <div className="ap-pold__zone-reason">{z.reason}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="ap-pold__grid">
            <section className="ap-card">
              <div className="ap-card__head">
                <div>
                  <div className="ap-card__eyebrow">Allowed operations</div>
                </div>
              </div>
              <div className="ap-pold__ops">
                {policy.allowedOperations.map((o) => (
                  <Chip key={o} tone="success" mono>
                    {o}
                  </Chip>
                ))}
              </div>
            </section>

            <section className="ap-card">
              <div className="ap-card__head">
                <div>
                  <div className="ap-card__eyebrow">Forbidden operations</div>
                </div>
              </div>
              {policy.forbiddenOperations.length === 0 ? (
                <div className="ap-pold__muted">— (none)</div>
              ) : (
                <div className="ap-pold__ops">
                  {policy.forbiddenOperations.map((o) => (
                    <Chip key={o} tone="danger" mono>
                      {o}
                    </Chip>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="ap-pold__grid">
            <section className="ap-card">
              <div className="ap-card__head">
                <div>
                  <div className="ap-card__eyebrow">Approval policy</div>
                </div>
              </div>
              <dl className="ap-kv">
                <dt>high-risk tiers</dt>
                <dd>
                  {policy.approvalPolicy.requireApprovalForRisk.map((r) => (
                    <Chip key={r} tone="warn">{r}</Chip>
                  ))}
                </dd>
                <dt>protected zone</dt>
                <dd>{policy.approvalPolicy.requireApprovalForProtectedZone ? "required" : "optional"}</dd>
                <dt>public surface</dt>
                <dd>{policy.approvalPolicy.requireApprovalForPublicSurface ? "required" : "optional"}</dd>
              </dl>
            </section>

            <section className="ap-card">
              <div className="ap-card__head">
                <div>
                  <div className="ap-card__eyebrow">Risk policy (hard caps)</div>
                </div>
              </div>
              <dl className="ap-kv">
                <dt>max risk</dt>
                <dd>
                  <Chip tone={policy.riskPolicy.maxRisk === "low" ? "success" : policy.riskPolicy.maxRisk === "medium" ? "muted" : "warn"}>
                    {policy.riskPolicy.maxRisk}
                  </Chip>
                </dd>
                <dt>files / PR</dt>
                <dd className="ap-mono">≤ {policy.riskPolicy.maxFilesPerPr}</dd>
                <dt>lines / PR</dt>
                <dd className="ap-mono">≤ {policy.riskPolicy.maxChangedLinesPerPr}</dd>
                <dt>PRs / run</dt>
                <dd className="ap-mono">≤ {policy.riskPolicy.maxPrsPerRun}</dd>
              </dl>
            </section>
          </div>

          <section className="ap-card">
            <div className="ap-card__head">
              <div>
                <div className="ap-card__eyebrow">Allowed operators</div>
              </div>
            </div>
            <div className="ap-pold__ops">
              {policy.allowedOperators.map((o) => (
                <Chip key={o} tone="muted" mono>
                  {o}
                </Chip>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <pre className="ap-pold__yaml">{yaml}</pre>
      )}

      <div className="ap-pold__hint">
        <Kbd>Esc</Kbd>
        <span>back to policies</span>
      </div>
    </div>
  );
}

function serializeYaml(p: EngineeringPolicy): string {
  const lines: string[] = [];
  lines.push(`# .quanta/policies/${p.id}.yaml`);
  lines.push(`id: ${p.id}`);
  lines.push(`name: ${JSON.stringify(p.name)}`);
  lines.push(`scope:`);
  if (p.scope.repo) lines.push(`  repo: true`);
  if (p.scope.paths && p.scope.paths.length > 0) {
    lines.push(`  paths:`);
    for (const path of p.scope.paths) lines.push(`    - ${path}`);
  }
  lines.push(`allowedOperators:`);
  for (const o of p.allowedOperators) lines.push(`  - ${o}`);
  lines.push(`allowedOperations:`);
  for (const o of p.allowedOperations) lines.push(`  - ${o}`);
  lines.push(`forbiddenOperations:`);
  for (const o of p.forbiddenOperations) lines.push(`  - ${o}`);
  lines.push(`protectedZones:`);
  for (const z of p.protectedZones) {
    lines.push(`  - path: ${z.path}`);
    lines.push(`    reason: ${JSON.stringify(z.reason)}`);
    lines.push(`    mode: ${z.mode}`);
  }
  lines.push(`approvalPolicy:`);
  lines.push(`  requireApprovalForRisk: [${p.approvalPolicy.requireApprovalForRisk.join(", ")}]`);
  lines.push(`  requireApprovalForProtectedZone: ${p.approvalPolicy.requireApprovalForProtectedZone}`);
  lines.push(`  requireApprovalForPublicSurface: ${p.approvalPolicy.requireApprovalForPublicSurface}`);
  lines.push(`riskPolicy:`);
  lines.push(`  maxRisk: ${p.riskPolicy.maxRisk}`);
  lines.push(`  maxFilesPerPr: ${p.riskPolicy.maxFilesPerPr}`);
  lines.push(`  maxChangedLinesPerPr: ${p.riskPolicy.maxChangedLinesPerPr}`);
  lines.push(`  maxPrsPerRun: ${p.riskPolicy.maxPrsPerRun}`);
  return lines.join("\n");
}
