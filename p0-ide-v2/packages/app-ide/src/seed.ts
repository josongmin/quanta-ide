import type { FeatureManifest } from "@quanta/shell-contract";
import { focusStore } from "@quanta/app-ide/stores/focus-store";
import { tabBus } from "@quanta/shell/stores/tab-bus";

/**
 * IDE app feature manifests.
 *
 * Covers: inspector modes (flow, blast, incidents, behavior, ownership),
 * simulate-change, ask-agent, code-editor, and prompt-firewall.
 *
 * Phase A: imported from `@/` paths. Phase B will co-locate stores.
 */
export const IDE_FEATURES: readonly FeatureManifest[] = [
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
];
