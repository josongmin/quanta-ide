export {
  parseRules,
  stringifyDocument,
} from "./model/parser";
export {
  BUILTIN_ADAPTERS,
  claudeAdapter,
  cursorAdapter,
  copilotAdapter,
  neutralAdapter,
  getAdapter,
} from "./model/adapters";
export { buildDocument } from "./model/build";
export {
  rulesStore,
  useRulesStore,
  type RulesState,
} from "./model/rules-store";
export { SAMPLE_RULES_SOURCE } from "./model/sample";
export type {
  Adapter,
  AdapterCapabilities,
  BuildArtifact,
  BuildResult,
  BuildTarget,
  Capability,
  Diagnostic,
  DiagnosticKind,
  RenderResult,
  RulesDocMeta,
  RulesDocument,
  RulesSection,
} from "./model/types";
