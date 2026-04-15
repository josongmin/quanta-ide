import { useSyncExternalStore } from "react";
import { buildDocument } from "./build";
import { parseRules } from "./parser";
import { SAMPLE_RULES_SOURCE } from "./sample";
import type { BuildResult, BuildTarget, RulesDocument } from "./types";

const DEFAULT_TARGETS: readonly BuildTarget[] = [
  { id: "claude", label: "Claude", outputPath: "CLAUDE.md", adapterId: "claude" },
  { id: "cursor", label: "Cursor", outputPath: ".cursorrules", adapterId: "cursor" },
  { id: "copilot", label: "Copilot", outputPath: ".github/copilot-instructions.md", adapterId: "copilot" },
  { id: "agent_md", label: "AGENT.md", outputPath: "AGENT.md", adapterId: "neutral" },
];

export interface RulesState {
  source: string;
  doc: RulesDocument;
  build: BuildResult;
  targets: readonly BuildTarget[];
  lastBuiltAt: number;
}

function compute(source: string, targets: readonly BuildTarget[]): RulesState {
  const doc = parseRules(source);
  const build = buildDocument(doc, targets);
  return {
    source,
    doc,
    build,
    targets,
    lastBuiltAt: Date.now(),
  };
}

let state: RulesState = compute(SAMPLE_RULES_SOURCE, DEFAULT_TARGETS);

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const rulesStore = {
  get: (): RulesState => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  setSource: (source: string) => {
    state = compute(source, state.targets);
    emit();
  },
  rebuild: () => {
    state = compute(state.source, state.targets);
    emit();
  },
  setTargets: (targets: readonly BuildTarget[]) => {
    state = compute(state.source, targets);
    emit();
  },
  reset: () => {
    state = compute(SAMPLE_RULES_SOURCE, DEFAULT_TARGETS);
    emit();
  },
};

export function useRulesStore<T>(selector: (s: RulesState) => T): T {
  return useSyncExternalStore(rulesStore.subscribe, () => selector(state), () => selector(state));
}
