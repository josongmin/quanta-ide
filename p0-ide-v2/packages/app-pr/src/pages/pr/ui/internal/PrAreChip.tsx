import { tabBus } from "@quanta/shell/stores/tab-bus";
import { useAutopilot } from "@quanta/app-autopilot/stores";

/**
 * If this PR was filed by autopilot (ARE run with matching PR number), show a
 * "proof-carrying" chip that deep-links into Autopilot's proof detail.
 */
export function PrAreChip({ prNumber }: { prNumber: number }) {
  const proof = useAutopilot((s) => {
    const run = s.runs.find((r) => r.prNumber === prNumber);
    if (!run || !run.proofArtifactId) return null;
    return s.proofs.find((p) => p.id === run.proofArtifactId) ?? null;
  });

  if (!proof) return null;

  const rec = proof.reviewerRecommendation.kind;
  const tone = rec === "skip" ? "pass" : rec === "focus" ? "fail" : "running";

  return (
    <button
      type="button"
      className={`pr-page__chip pr-page__chip--ci-${tone}`}
      title={`Reviewer recommendation: ${rec} · ${proof.reviewerRecommendation.rationale}`}
      onClick={() =>
        tabBus.open("autopilot", "Autopilot · Proof", {
          route: { path: ["proofs", proof.id] },
        })
      }
      style={{ cursor: "pointer", borderStyle: "dashed" }}
    >
      <span className="pr-page__chip-dot" />
      <span style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9, fontWeight: 700 }}>
        autopilot proof · {rec}
      </span>
    </button>
  );
}
