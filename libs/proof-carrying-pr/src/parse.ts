// JSON text → validated ProofCarryingPR. The only path external callers
// should use to ingest `.quanta-proof.json` content. Never trust the value
// of `JSON.parse` directly — the structural validator catches drift between
// file-on-disk and the runtime schema.

import type { ProofCarryingPR } from "./types";
import type { ValidationError } from "./validate";
import { validateProof } from "./validate";

/**
 * Parse a JSON string into a {@link ProofCarryingPR}, validating the
 * shape in the same pass. Returns a tagged union; never throws on
 * malformed input.
 *
 * Malformed JSON is reported with `path: "$"` so downstream UIs can
 * treat it uniformly with schema errors.
 *
 * @example
 * const text = fs.readFileSync(".quanta-proof.json", "utf8");
 * const { proof, errors } = parseProofJson(text);
 * if (!proof) console.error(errors);
 */
export function parseProofJson(
  text: string,
): { proof: ProofCarryingPR | null; errors: ValidationError[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      proof: null,
      errors: [{ path: "$", reason: `invalid JSON: ${message}` }],
    };
  }
  const result = validateProof(raw);
  if (result.ok) return { proof: result.proof, errors: [] };
  return { proof: null, errors: result.errors };
}
