// Serializers for ProofCarryingPR.
//
// JSON: stable key order (recursive alphabetical sort) so two runs of the
// same generator over the same input produce byte-identical output. That
// matters for the signature field — the signer commits to a canonical
// byte stream, not a JS-object shape.
//
// Markdown: compact, copy-pastable into a PR body. Follows the layout in
// RFC §Proof 부착 방식. ASCII-compatible arrow glyph ("→") is intentional.

import type { ProofCarryingPR, VerifierStatus } from "./types";

/**
 * Recursively sort object keys to produce deterministic JSON output.
 * Arrays preserve element order. Non-plain values pass through.
 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) {
      out[key] = sortKeys(src[key]);
    }
    return out;
  }
  return value;
}

/**
 * Serialize a proof to a stable, pretty-printed JSON string.
 *
 * Output is byte-deterministic for a given input — keys are sorted
 * alphabetically at every nesting level. 2-space indent for readability
 * in PR attachments.
 *
 * @example
 * const json = serializeProofJson(proof);
 * fs.writeFileSync(".quanta-proof.json", json);
 */
export function serializeProofJson(p: ProofCarryingPR): string {
  return JSON.stringify(sortKeys(p), null, 2);
}

function statusGlyph(s: VerifierStatus): string {
  switch (s) {
    case "pass":
      return "✓"; // ✓
    case "fail":
      return "✕"; // ✕
    case "unknown":
      return "?";
  }
}

function countClassification(
  p: ProofCarryingPR,
  kind: "mechanical" | "logic-preserved" | "new-behavior" | "risky",
): number {
  let n = 0;
  for (const a of p.attestations) if (a.classification === kind) n++;
  return n;
}

/**
 * Render a proof as a human-readable markdown block suitable for pasting
 * into a PR body. Uses a `<details>` block for the full attestation
 * table so the summary line is always visible but the long table stays
 * collapsed by default.
 *
 * @example
 * const md = serializeProofMarkdown(proof);
 * fs.writeFileSync("proof.md", md);
 */
export function serializeProofMarkdown(p: ProofCarryingPR): string {
  const pct = Math.round(p.coverage.ratio * 100);
  const riskyCount = countClassification(p, "risky");
  const lines: string[] = [];
  lines.push("## Engine proof");
  lines.push(
    `Verified ${p.coverage.verifiedHunks}/${p.coverage.totalHunks} hunks (${pct}%) ` +
      `· ${riskyCount} risky spots ` +
      `· counterfactual apply: ${p.counterfactuals.apply.cost} ${p.counterfactuals.apply.unit} ` +
      `· dismiss: ${p.counterfactuals.dismiss.cost} ${p.counterfactuals.dismiss.unit}`,
  );
  lines.push("");
  lines.push("<details>");
  lines.push(
    `<summary>Full attestation (${p.attestations.length} hunks)</summary>`,
  );
  lines.push("");
  lines.push("| File | Hunk | Class | Risk Δ | Checks |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const a of p.attestations) {
    const checks = a.checks
      .map((c) => `${c.verifier} ${statusGlyph(c.status)}`)
      .join(" · ");
    lines.push(
      `| ${a.file} | ${a.hunkHeader} | ${a.classification} | ${a.risk.before} → ${a.risk.after} | ${checks} |`,
    );
  }
  lines.push("");
  lines.push("</details>");
  return lines.join("\n");
}
