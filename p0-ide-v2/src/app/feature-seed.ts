import { featureRegistry, type FeatureManifest } from "@/shared/model/feature-registry";
import { focusStore } from "@/shared/model/focus-store";
import { tabBus } from "@/shared/model/tab-bus";
import { uiBus } from "@/shared/model/ui-bus";
import { rulesStore } from "@/entities/agent-rules";
import { complianceStore } from "@/entities/compliance";
import { toast } from "@/shared/model/toast-store";
import { shortcutRegistry } from "@/shared/model/shortcut-registry";

function openRulesModal() {
  uiBus.toggleRules(true);
}

const FEATURES: readonly FeatureManifest[] = [
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
    id: "flow-analysis",
    title: "Flow Analysis",
    description: "Taint source → sink paths with OWASP categories and sanitizer hints.",
    category: "intelligence",
    visibility: "user",
    version: "0.3.1",
    commands: [
      {
        id: "flow.openInspector",
        title: "Show Flow Inspector",
        keybinding: "⌘2",
        run: () => focusStore.setMode("flow"),
      },
    ],
  },
  {
    id: "blast-radius",
    title: "Blast Radius",
    description: "Change impact ranked by risk, behavior diff, and test coverage.",
    category: "intelligence",
    visibility: "user",
    version: "0.4.0",
    commands: [
      {
        id: "blast.openInspector",
        title: "Show Blast Inspector",
        keybinding: "⌘3",
        run: () => focusStore.setMode("blast"),
      },
    ],
  },
  {
    id: "incident-dna",
    title: "Incident DNA",
    description: "Match current file patterns against past postmortems.",
    category: "intelligence",
    visibility: "user",
    version: "0.2.0",
    badge: "beta",
    commands: [
      {
        id: "incidents.openInspector",
        title: "Show Incidents Inspector",
        keybinding: "⌘4",
        run: () => focusStore.setMode("incidents"),
      },
    ],
  },
  {
    id: "behavior-diff",
    title: "Behavior Diff",
    description: "Syntax / semantic / runtime delta with before-after execution.",
    category: "intelligence",
    visibility: "user",
    version: "0.2.0",
    commands: [
      {
        id: "behavior.openInspector",
        title: "Show Behavior Inspector",
        keybinding: "⌘5",
        run: () => focusStore.setMode("behavior"),
      },
    ],
  },
  {
    id: "ownership",
    title: "Ownership",
    description: "Call-graph-weighted ownership, roles, bus factor.",
    category: "intelligence",
    visibility: "user",
    version: "0.1.0",
    commands: [
      {
        id: "ownership.openInspector",
        title: "Show Ownership Inspector",
        keybinding: "⌘6",
        run: () => focusStore.setMode("ownership"),
      },
    ],
  },
  {
    id: "simulate-change",
    title: "Simulate Change",
    description: "Predict blast / taint / cpx delta before an edit.",
    category: "editing",
    visibility: "user",
    version: "0.2.0",
    commands: [
      {
        id: "simulate.open",
        title: "Open Simulate Overlay",
        keybinding: "⌘⇧S",
        run: () => focusStore.toggleSimulate(true),
      },
    ],
  },
  {
    id: "ask-agent",
    title: "Ask Agent",
    description: "Auto-inject blast / taint / ownership context into a question.",
    category: "editing",
    visibility: "user",
    version: "0.3.0",
    commands: [
      {
        id: "ask.open",
        title: "Ask Agent (with context)",
        keybinding: "⌘E",
        run: () => focusStore.toggleContextInject(true),
      },
    ],
  },
  {
    id: "code-editor",
    title: "Code Editor",
    description: "Open the workspace editor with full engine signals and overlays wired in.",
    category: "editing",
    visibility: "user",
    version: "0.1.0",
    primary: {
      tileLabel: "Code Editor",
      tileHint: "⌘O",
      tileRun: () => tabBus.open("ide", "new-repo"),
    },
  },
  {
    id: "ai-coding-agent",
    title: "AI Coding Agent",
    description: "Start a coding session with full engine context injected.",
    category: "workflow",
    visibility: "user",
    version: "0.1.0",
    primary: {
      tileLabel: "AI Coding Agent",
      tileHint: "⌘J",
      tileRun: () => tabBus.open("agent", "Agent Session"),
    },
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
  {
    id: "counterfactual",
    title: "Counterfactual Projection",
    description:
      "Engine-projected trajectory of risk, blast, cpx, coverage and incident probability over 7/14/30/90 days.",
    category: "intelligence",
    visibility: "user",
    version: "0.1.0",
    badge: "new",
    commands: [
      {
        id: "scenario.open",
        title: "Open Scenario workspace",
        keybinding: "⌘⇧C",
        run: () => tabBus.open("scenario", "Scenario · execute()"),
      },
    ],
  },
  {
    id: "prompt-firewall",
    title: "Prompt Injection Firewall",
    description:
      "Context provenance + 7 injection scanners. Untrusted chunks require confirm before the agent acts on them.",
    category: "integration",
    visibility: "user",
    version: "0.1.0",
    badge: "new",
    commands: [
      {
        id: "firewall.openOverlay",
        title: "Open Firewall overlay",
        keybinding: "⌘⇧F",
        description: "Inspect context provenance and resolve untrusted chunks.",
        run: () => focusStore.toggleFirewall(true),
      },
    ],
    settings: [
      {
        key: "firewall.blockTainted",
        label: "Block tainted chunks by default",
        type: "boolean",
        default: true,
      },
      {
        key: "firewall.autoConfirmUntrusted",
        label: "Auto-confirm untrusted MCP responses",
        type: "boolean",
        default: false,
      },
    ],
  },
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
  {
    id: "settings",
    title: "Settings",
    description:
      "Global settings workspace. Aggregates every registered feature's settings into a single Chrome-style tab.",
    category: "workflow",
    visibility: "user",
    version: "0.1.0",
    commands: [
      {
        id: "settings.open",
        title: "Open Settings",
        keybinding: "⌘,",
        run: () => uiBus.toggleSettings(true),
      },
    ],
  },
  {
    id: "dev-console",
    title: "Dev Console",
    description: "Registry, events, and feature graph for internal debugging.",
    category: "integration",
    visibility: "dev-only",
    version: "0.1.0",
    commands: [
      {
        id: "dev.openConsole",
        title: "Open Dev Console",
        keybinding: "⌘⌥⇧D",
        run: () => uiBus.toggleDevConsole(true),
      },
    ],
  },
];

let seeded = false;

export function seedFeatures(): void {
  if (seeded) return;
  seeded = true;
  for (const f of FEATURES) {
    featureRegistry.register(f);
    for (const cmd of f.commands ?? []) {
      if (!cmd.keybinding) continue;
      shortcutRegistry.register({
        id: cmd.id,
        keys: cmd.keybinding,
        label: cmd.title,
        run: (e) => {
          e.preventDefault();
          cmd.run();
        },
      });
    }
  }
}
