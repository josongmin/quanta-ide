import { describe, it, expect } from "vitest";
import { parseProofJson } from "./parse";
import { validateProof } from "./validate";
import type { ProofCarryingPR } from "./types";

function minimalProof(): ProofCarryingPR {
  return {
    prId: "gh:org/repo#1",
    commitSha: "deadbeef",
    generatedAt: 1_700_000_000_000,
    generator: {
      engineVersion: "0.1.0",
      verifierVersions: { taint: "v2" },
    },
    coverage: { totalHunks: 1, verifiedHunks: 1, ratio: 1 },
    attestations: [
      {
        file: "a.ts",
        hunkHeader: "@@ -1,2 +1,2 @@",
        verified: true,
        checks: [{ verifier: "taint", status: "pass" }],
        risk: { before: 10, after: 10 },
        classification: "mechanical",
      },
    ],
    counterfactuals: {
      apply: { cost: 0.1, unit: "eng-days" },
      dismiss: { cost: 1, unit: "eng-days" },
    },
    complianceSummary: { pass: 1, fail: 0, unknown: 0, liesDetected: 0 },
    patchTrailRefs: [],
    signature: "sha256:abc",
  };
}

describe("parseProofJson", () => {
  it("parses valid JSON with valid schema", () => {
    const text = JSON.stringify(minimalProof());
    const { proof, errors } = parseProofJson(text);
    expect(errors).toEqual([]);
    expect(proof).not.toBeNull();
    expect(proof?.prId).toBe("gh:org/repo#1");
    expect(proof?.attestations).toHaveLength(1);
  });

  it("reports invalid JSON with path $", () => {
    const { proof, errors } = parseProofJson("{ not json");
    expect(proof).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe("$");
    expect(errors[0].reason).toMatch(/invalid JSON/);
  });

  it("reports schema errors when JSON is valid but shape is wrong", () => {
    const bad = { prId: "x" };
    const { proof, errors } = parseProofJson(JSON.stringify(bad));
    expect(proof).toBeNull();
    expect(errors.length).toBeGreaterThan(1);
  });

  it("reports top-level non-object with path $", () => {
    const { proof, errors } = parseProofJson("42");
    expect(proof).toBeNull();
    expect(errors).toEqual([{ path: "$", reason: "expected object" }]);
  });
});

describe("validateProof", () => {
  it("accepts a minimal valid proof", () => {
    const result = validateProof(minimalProof());
    expect(result.ok).toBe(true);
  });

  it("flags missing prId", () => {
    const p = minimalProof() as unknown as Record<string, unknown>;
    delete p["prId"];
    const result = validateProof(p);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "prId")).toBe(true);
    }
  });

  it("flags bad classification enum", () => {
    const p = minimalProof();
    const mutated = JSON.parse(JSON.stringify(p));
    mutated.attestations[0].classification = "not-a-class";
    const result = validateProof(mutated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const err = result.errors.find(
        (e) => e.path === "attestations[0].classification",
      );
      expect(err).toBeDefined();
      expect(err?.reason).toMatch(/expected one of/);
    }
  });

  it("flags ratio out of [0,1] range", () => {
    const p = minimalProof();
    const mutated = JSON.parse(JSON.stringify(p));
    mutated.coverage.ratio = 1.5;
    const result = validateProof(mutated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.path === "coverage.ratio" && /in \[0, 1\]/.test(e.reason),
        ),
      ).toBe(true);
    }
  });

  it("flags nested check errors with full path", () => {
    const p = minimalProof();
    const mutated = JSON.parse(JSON.stringify(p));
    mutated.attestations[0].checks[0].status = "maybe";
    const result = validateProof(mutated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.path === "attestations[0].checks[0].status",
        ),
      ).toBe(true);
    }
  });

  it("flags negative cost in counterfactual", () => {
    const p = minimalProof();
    const mutated = JSON.parse(JSON.stringify(p));
    mutated.counterfactuals.apply.cost = -1;
    const result = validateProof(mutated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.path === "counterfactuals.apply.cost" && />= 0/.test(e.reason),
        ),
      ).toBe(true);
    }
  });

  it("collects multiple errors in one pass", () => {
    const bad: Record<string, unknown> = {
      prId: 42, // wrong type
      commitSha: "ok",
      generatedAt: "nope", // wrong type
      generator: {},
      coverage: { totalHunks: -1, verifiedHunks: 0, ratio: 2 },
      attestations: [],
      counterfactuals: {
        apply: { cost: 0, unit: "eng-days" },
        dismiss: { cost: 0, unit: "eng-days" },
      },
      complianceSummary: { pass: 0, fail: 0, unknown: 0, liesDetected: 0 },
      patchTrailRefs: [],
      signature: "s",
    };
    const result = validateProof(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // should have errors for prId, generatedAt, coverage.totalHunks, coverage.ratio, generator.engineVersion, generator.verifierVersions
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("rejects a non-object root with path $", () => {
    const result = validateProof(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([{ path: "$", reason: "expected object" }]);
    }
  });
});
