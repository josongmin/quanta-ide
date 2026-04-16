import type { FeatureManifest } from "@quanta/shell-contract";
import { tabBus } from "@quanta/shell/stores/tab-bus";
import { toast } from "@quanta/shell/stores/toast-store";

/**
 * Reviews app feature manifests.
 *
 * Covers: pr-review and proof-carrying-pr.
 *
 * Phase A: imported from `@/` paths. Phase B will co-locate stores.
 */
export const REVIEWS_FEATURES: readonly FeatureManifest[] = [
  {
    id: "pr-review",
    title: "PR Review",
    description: "Review pull requests with auto-fix and blast radius.",
    category: "workflow",
    visibility: "user",
    version: "0.1.0",
    primary: {
      tileLabel: "PR Review",
      tileHint: "⌘⇧P",
      tileRun: () => tabBus.open("pr", "PR Review"),
    },
  },
  {
    id: "proof-carrying-pr",
    title: "Proof-Carrying PR",
    description:
      "AI PRs ship with per-hunk engine attestation, compliance summary, and counterfactual cost. Reviewers focus on risky hunks only.",
    category: "workflow",
    visibility: "user",
    version: "0.1.0",
    badge: "new",
    dependsOn: ["compliance-verifier", "counterfactual"],
    commands: [
      {
        id: "reviews.open",
        title: "Open Reviews workspace",
        keybinding: "⌘⇧Y",
        run: () => tabBus.open("reviews", "Reviews"),
      },
      {
        id: "reviews.prepare",
        title: "Prepare PR with proof",
        description: "Run quanta pr prepare for the current branch (mock).",
        run: () =>
          toast.success(
            "Proof generated",
            "per-hunk attestation + compliance + counterfactual attached to .quanta-proof.json",
            "proof-carrying PR",
          ),
      },
    ],
    settings: [
      {
        key: "reviews.autoMergeMechanical",
        label: "Auto-merge mechanical-only PRs",
        type: "boolean",
        default: false,
      },
      {
        key: "reviews.blockUnverified",
        label: "Block merge if proof missing",
        type: "boolean",
        default: true,
      },
    ],
  },
];
