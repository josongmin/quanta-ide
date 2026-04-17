import type { FeatureManifest } from "@quanta/shell-contract";
import { tabBus } from "@quanta/shell/stores/tab-bus";
import { policyStore } from "@quanta/app-policy/entities/policy";

export const POLICY_FEATURES: readonly FeatureManifest[] = [
  {
    id: "engineering-policy",
    title: "Engineering Policy",
    description:
      "Define, browse, and enforce team architecture / code-quality rules. Track violations.",
    category: "rules",
    visibility: "user",
    version: "0.1.0",
    badge: "new",
    commands: [
      {
        id: "policy.open",
        title: "Open Engineering Policy",
        keybinding: "⌘⇧E",
        description: "Browse and manage team policy rules.",
        run: () => tabBus.open("policy", "Policy"),
      },
      {
        id: "policy.newRule",
        title: "Create new policy rule",
        description: "Open the rule builder with a blank template.",
        run: () => {
          tabBus.open("policy", "Policy");
          policyStore.startNewRule();
        },
      },
      {
        id: "policy.violations",
        title: "Show policy violations",
        description: "Jump to the violations view.",
        run: () => {
          tabBus.open("policy", "Policy");
          policyStore.setSidebarItem("alerts-triage");
        },
      },
    ],
    settings: [
      {
        key: "policy.prGateDefault",
        label: "Enable PR gate by default for new rules",
        type: "boolean",
        default: true,
      },
      {
        key: "policy.showInactiveRules",
        label: "Show inactive rules in library",
        type: "boolean",
        default: false,
      },
    ],
  },
];
