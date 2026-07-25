export type KnobKind = "feature-flag" | "env" | "secret" | "remote-config";
export type KnobType = "bool" | "string" | "number" | "enum";

export interface ConfigReference {
  file: string;
  line: number;
  /** Source-line snippet for inline preview. */
  snippet: string;
  /** Symbol containing the reference (function/class). */
  symbol?: string;
}

export interface ConfigBranch {
  /** Predicate written in source (e.g. `flag === true`). */
  when: string;
  /** Description of the code path taken when this branch holds. */
  effect: string;
  refs: ConfigReference[];
  /** Reachable downstream symbols when this branch is taken. */
  reaches: string[];
}

export interface ConfigKnob {
  id: string;
  name: string;
  kind: KnobKind;
  type: KnobType;
  /** What this knob does in product terms. */
  purpose: string;
  /** Current production value (mock-displayed). */
  current: string | number | boolean;
  /** Allowed values for enum/bool. */
  values?: (string | number | boolean)[];
  /** Owning team. */
  owner: string;
  /** Branches gated by this knob. */
  branches: ConfigBranch[];
  /** Direct references including non-branching reads. */
  refs: ConfigReference[];
}

export interface ConfigImpact {
  knobs: ConfigKnob[];
}
