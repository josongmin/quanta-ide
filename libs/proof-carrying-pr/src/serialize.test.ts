import { describe, it, expect } from "vitest";
import { parseProofJson } from "./parse";
import { serializeProofJson, serializeProofMarkdown } from "./serialize";
import type { ProofCarryingPR } from "./types";

function minimal(): ProofCarryingPR {
  return {
    prId: "gh:org/repo#1",
    commitSha: "sha",
    generatedAt: 1,
    generator: { engineVersion: "0.1", verifierVersions: { taint: "v2" } },
    coverage: { totalHunks: 1, verifiedHunks: 1, ratio: 1 },
    attestations: [
      {
        file: "a.ts",
        hunkHeader: "@@ -1,1 +1,1 @@",
        verified: true,
        checks: [{ verifier: "taint", status: "pass" }],
        risk: { before: 0, after: 0 },
        classification: "mechanical",
      },
    ],
    counterfactuals: {
      apply: { cost: 0, unit: "eng-days" },
      dismiss: { cost: 0, unit: "eng-days" },
    },
    complianceSummary: { pass: 0, fail: 0, unknown: 0, liesDetected: 0 },
    patchTrailRefs: [],
    signature: "sig",
  };
}

function rich(): ProofCarryingPR {
  return {
    prId: "gh:org/repo#482",
    commitSha: "deadbeef",
    generatedAt: 1_700_000_000_000,
    generator: {
      engineVersion: "0.2.0",
      verifierVersions: { taint: "v2", behavior: "v1", arch: "v3" },
    },
    coverage: { totalHunks: 48, verifiedHunks: 42, ratio: 42 / 48 },
    attestations: [
      {
        file: "orchestrator.py",
        hunkHeader: "@@ -212,6 +212,8 @@",
        verified: true,
        checks: [
          { verifier: "taint", status: "pass" },
          { verifier: "behavior", status: "pass" },
        ],
        risk: { before: 20, after: 18 },
        classification: "logic-preserved",
      },
      {
        file: "experience_store.py",
        hunkHeader: "@@ -84,9 +84,9 @@",
        verified: false,
        checks: [
          { verifier: "taint", status: "fail", detail: "new sink" },
          { verifier: "behavior", status: "unknown" },
        ],
        risk: { before: 40, after: 70 },
        classification: "risky",
      },
    ],
    counterfactuals: {
      apply: { cost: 0.3, unit: "eng-days" },
      dismiss: { cost: 2.8, unit: "eng-days" },
    },
    complianceSummary: { pass: 7, fail: 1, unknown: 0, liesDetected: 0 },
    patchTrailRefs: ["sym:orchestrator.run"],
    signature: "sha256:abc",
  };
}

describe("serializeProofJson", () => {
  it("produces sorted keys at every level", () => {
    const text = serializeProofJson(rich());
    const parsed = JSON.parse(text);
    const topKeys = Object.keys(parsed);
    expect(topKeys).toEqual([...topKeys].sort());
    expect(Object.keys(parsed.generator)).toEqual(
      [...Object.keys(parsed.generator)].sort(),
    );
    expect(Object.keys(parsed.generator.verifierVersions)).toEqual(
      [...Object.keys(parsed.generator.verifierVersions)].sort(),
    );
    for (const a of parsed.attestations) {
      expect(Object.keys(a)).toEqual([...Object.keys(a)].sort());
      for (const c of a.checks) {
        expect(Object.keys(c)).toEqual([...Object.keys(c)].sort());
      }
    }
  });

  it("is byte-identical for structurally-equal inputs with different key order", () => {
    const a = rich();
    // Rebuild with different insertion order at one level.
    const b: ProofCarryingPR = {
      ...a,
      coverage: { ratio: a.coverage.ratio, verifiedHunks: a.coverage.verifiedHunks, totalHunks: a.coverage.totalHunks },
    };
    expect(serializeProofJson(a)).toBe(serializeProofJson(b));
  });

  it("round-trips via parseProofJson", () => {
    const original = rich();
    const text = serializeProofJson(original);
    const { proof, errors } = parseProofJson(text);
    expect(errors).toEqual([]);
    expect(proof).not.toBeNull();
    // Serialize again and expect exact equality.
    if (proof) expect(serializeProofJson(proof)).toBe(text);
  });

  it("preserves attestation array order (arrays are not sorted)", () => {
    const text = serializeProofJson(rich());
    const parsed = JSON.parse(text);
    expect(parsed.attestations[0].file).toBe("orchestrator.py");
    expect(parsed.attestations[1].file).toBe("experience_store.py");
  });
});

describe("serializeProofMarkdown", () => {
  it("renders for a minimal proof", () => {
    const md = serializeProofMarkdown(minimal());
    expect(md).toContain("## Engine proof");
    expect(md).toContain("1/1 hunks (100%)");
    expect(md).toContain("0 risky spots");
    expect(md).toContain("<details>");
    expect(md).toContain("</details>");
    expect(md).toContain("| a.ts | @@ -1,1 +1,1 @@ | mechanical | 0 → 0 |");
  });

  it("renders for a rich proof with risky hunks and multiple checks", () => {
    const md = serializeProofMarkdown(rich());
    expect(md).toContain("42/48 hunks (88%)");
    expect(md).toContain("1 risky spots");
    expect(md).toContain("counterfactual apply: 0.3 eng-days");
    expect(md).toContain("dismiss: 2.8 eng-days");
    // Risk delta with ASCII arrow
    expect(md).toContain("40 → 70");
    // Check glyphs
    expect(md).toContain("taint ✓");
    expect(md).toContain("taint ✕");
    expect(md).toContain("behavior ?");
  });

  it("opens details with the hunk count", () => {
    const md = serializeProofMarkdown(rich());
    expect(md).toContain("Full attestation (2 hunks)");
  });
});
