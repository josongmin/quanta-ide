// Public API for @quanta/proof-carrying-pr.
//
// Consumers should import only from this module; internals (`./validate`,
// `./adapter`, …) are implementation details and may be refactored.

export type {
  ProofCarryingPR,
  HunkAttestation,
  HunkCheck,
  HunkClassification,
  VerifierStatus,
  ProjectionSummary,
} from "./types";
export { parseProofJson } from "./parse";
export { serializeProofJson, serializeProofMarkdown } from "./serialize";
export { validateProof, type ValidationError } from "./validate";
export { toAdmissionVerdict, type AdmissionVerdictLike } from "./adapter";
