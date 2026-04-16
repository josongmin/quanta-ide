import type { FeatureManifest } from "@quanta/shell-contract";
import { rulesStore } from "@/entities/agent-rules";
import { complianceStore } from "@/entities/compliance";
import { tabBus } from "@/shared/model/tab-bus";
import { uiBus } from "@/shared/model/ui-bus";
import { toast } from "@/shared/model/toast-store";

function openRulesModal() {
  uiBus.toggleRules(true);
}

/**
 * Rules app feature manifests.
 *
 * Covers: agent-rules and compliance-verifier.
 *
 * Phase A: imported from `@/` paths. Phase B will co-locate stores.
 */
export const RULES_FEATURES: readonly FeatureManifest[] = [
  {
    id: "agent-rules",
    title: "Agent Rules",
    description: "One neutral source, compiled to Claude / Cursor / Copilot / AGENT.md.",
    category: "rules",
    visibility: "user",
    version: "0.1.0",
    badge: "new",
    commands: [
      {
        id: "rules.openWorkspace",
        title: "Open Agent Rules Workspace",
        keybinding: "⌘⇧R",
        description: "Edit the neutral rules source and preview target formats.",
        run: openRulesModal,
      },
      {
        id: "rules.build",
        title: "Build Agent Rules",
        description: "Re-render all targets from the current source.",
        run: () => rulesStore.rebuild(),
      },
      {
        id: "rules.reset",
        title: "Reset Agent Rules to sample",
        description: "Replace the current source with the shipped example.",
        run: () => rulesStore.reset(),
      },
    ],
    settings: [
      {
        key: "rules.autoSync",
        label: "Auto-sync on save",
        type: "boolean",
        default: true,
        description: "Rebuild all targets whenever the source changes.",
      },
      {
        key: "rules.warnUnsupported",
        label: "Warn on unsupported sections",
        type: "boolean",
        default: true,
      },
    ],
  },
  {
    id: "compliance-verifier",
    title: "Rule Compliance",
    description:
      "Verify engine signals against rule contracts after every agent action — lies detected, evidence tokens issued.",
    category: "rules",
    visibility: "user",
    version: "0.1.0",
    badge: "new",
    dependsOn: ["agent-rules"],
    commands: [
      {
        id: "compliance.verifySession",
        title: "Verify session change set",
        description: "Re-run all verifiers against the last change and append to compliance log.",
        run: () => {
          const events = complianceStore.submit({
            id: `cs-${Date.now().toString(36)}`,
            label: "Manual session verify",
            files: ["orchestrator.py"],
            author: "human",
            agentClaim: undefined,
            sessionId: "s-live",
          });
          const pass = events.filter((e) => e.status === "pass").length;
          const fail = events.filter((e) => e.status === "fail").length;
          toast.success(
            `Compliance · ${pass} pass · ${fail} fail`,
            undefined,
            "compliance",
          );
        },
      },
      {
        id: "compliance.openLog",
        title: "Open compliance log",
        keybinding: "⌘⇧V",
        run: () => tabBus.open("agent", "Compliance log"),
      },
    ],
    settings: [
      {
        key: "compliance.blockOnFail",
        label: "Block Apply on any fail",
        type: "boolean",
        default: false,
        description: "Prevent patch application when any verifier fails (default off).",
      },
      {
        key: "compliance.toastOnLie",
        label: "Toast on lie detection",
        type: "boolean",
        default: true,
      },
    ],
  },
];
