import { describe, it, expect } from "vitest";
import { toAdmissionVerdict } from "./adapter";
import type { HunkAttestation, ProofCarryingPR } from "./types";

function att(partial: Partial<HunkAttestation> & {
  file: string;
  classification: HunkAttestation["classification"];
}): HunkAttestation {
  return {
    file: partial.file,
    hunkHeader: partial.hunkHeader ?? "@@ -1,1 +1,1 @@",
    verified: partial.verified ?? true,
    checks: partial.checks ?? [{ verifier: "taint", status: "pass" }],
    risk: partial.risk ?? { before: 10, after: 10 },
    classification: partial.classification,
  };
}

function proof(opts: {
  atts: HunkAttestation[];
  ratio: number;
  verifiedHunks?: number;
  totalHunks?: number;
  compliance?: ProofCarryingPR["complianceSummary"];
  prId?: string;
}): ProofCarryingPR {
  const totalHunks = opts.totalHunks ?? opts.atts.length;
  const verifiedHunks =
    opts.verifiedHunks ?? Math.round(opts.ratio * totalHunks);
  return {
    prId: opts.prId ?? "gh:org/repo#1",
    commitSha: "sha",
    generatedAt: 0,
    generator: {
      engineVersion: "0.1",
      verifierVersions: { taint: "v2" },
    },
    coverage: { totalHunks, verifiedHunks, ratio: opts.ratio },
    attestations: opts.atts,
    counterfactuals: {
      apply: { cost: 0, unit: "eng-days" },
      dismiss: { cost: 0, unit: "eng-days" },
    },
    complianceSummary: opts.compliance ?? {
      pass: 0,
      fail: 0,
      unknown: 0,
      liesDetected: 0,
    },
    patchTrailRefs: [],
    signature: "sig",
  };
}

describe("toAdmissionVerdict — decision boundaries", () => {
  it("BLOCK when risky and coverage < 0.6", () => {
    const p = proof({
      atts: [
        att({ file: "a.ts", classification: "risky" }),
        att({ file: "b.ts", classification: "mechanical" }),
      ],
      ratio: 0.5,
    });
    expect(toAdmissionVerdict(p).decision).toBe("BLOCK");
  });

  it("HOLD when risky but coverage >= 0.6", () => {
    const p = proof({
      atts: [
        att({ file: "a.ts", classification: "risky" }),
        att({ file: "b.ts", classification: "mechanical" }),
      ],
      ratio: 0.7,
    });
    expect(toAdmissionVerdict(p).decision).toBe("HOLD");
  });

  it("HOLD when no risky but coverage < 0.5", () => {
    const p = proof({
      atts: [att({ file: "a.ts", classification: "mechanical" })],
      ratio: 0.3,
    });
    expect(toAdmissionVerdict(p).decision).toBe("HOLD");
  });

  it("PASS when coverage >= 0.9 and no risky", () => {
    const p = proof({
      atts: [att({ file: "a.ts", classification: "mechanical" })],
      ratio: 0.95,
    });
    expect(toAdmissionVerdict(p).decision).toBe("PASS");
  });

  it("REVIEW when no risky and coverage in [0.5, 0.9)", () => {
    const p = proof({
      atts: [att({ file: "a.ts", classification: "mechanical" })],
      ratio: 0.7,
    });
    expect(toAdmissionVerdict(p).decision).toBe("REVIEW");
  });
});

describe("toAdmissionVerdict — confidence", () => {
  it("HIGH when verifier count >= 4 and coverage >= 0.7", () => {
    const checks = [
      { verifier: "v1", status: "pass" as const },
      { verifier: "v2", status: "pass" as const },
      { verifier: "v3", status: "pass" as const },
      { verifier: "v4", status: "pass" as const },
    ];
    const p = proof({
      atts: [att({ file: "a.ts", classification: "mechanical", checks })],
      ratio: 0.8,
    });
    expect(toAdmissionVerdict(p).confidence).toBe("HIGH");
  });

  it("LOW when verifier count < 2", () => {
    const p = proof({
      atts: [
        att({
          file: "a.ts",
          classification: "mechanical",
          checks: [{ verifier: "taint", status: "pass" }],
        }),
      ],
      ratio: 0.8,
    });
    expect(toAdmissionVerdict(p).confidence).toBe("LOW");
  });

  it("LOW when coverage < 0.4", () => {
    const checks = [
      { verifier: "v1", status: "pass" as const },
      { verifier: "v2", status: "pass" as const },
      { verifier: "v3", status: "pass" as const },
      { verifier: "v4", status: "pass" as const },
    ];
    const p = proof({
      atts: [att({ file: "a.ts", classification: "mechanical", checks })],
      ratio: 0.3,
    });
    expect(toAdmissionVerdict(p).confidence).toBe("LOW");
  });

  it("MEDIUM in between", () => {
    const checks = [
      { verifier: "v1", status: "pass" as const },
      { verifier: "v2", status: "pass" as const },
    ];
    const p = proof({
      atts: [att({ file: "a.ts", classification: "mechanical", checks })],
      ratio: 0.6,
    });
    expect(toAdmissionVerdict(p).confidence).toBe("MEDIUM");
  });
});

describe("toAdmissionVerdict — reasons & actions", () => {
  it("ranks risky hunks by |weight| in reasons (max 3)", () => {
    const p = proof({
      atts: [
        att({
          file: "a.ts",
          classification: "risky",
          risk: { before: 10, after: 90 }, // delta = 80
          hunkHeader: "@@ -1,2 +1,2 @@",
        }),
        att({
          file: "b.ts",
          classification: "risky",
          risk: { before: 10, after: 30 }, // delta = 20
          hunkHeader: "@@ -5,1 +5,1 @@",
        }),
        att({
          file: "c.ts",
          classification: "risky",
          risk: { before: 10, after: 50 }, // delta = 40
          hunkHeader: "@@ -9,3 +9,3 @@",
        }),
        att({
          file: "d.ts",
          classification: "risky",
          risk: { before: 10, after: 70 }, // delta = 60
          hunkHeader: "@@ -20,1 +20,1 @@",
        }),
      ],
      ratio: 0.8,
    });
    const v = toAdmissionVerdict(p);
    expect(v.reasons).toHaveLength(3);
    // The biggest delta (a.ts) should be first.
    expect(v.reasons[0].text).toContain("a.ts");
    expect(v.reasons[0].text).toContain("risk 10→90");
  });

  it("emits a reason when coverage < 0.7", () => {
    const p = proof({
      atts: [att({ file: "a.ts", classification: "mechanical" })],
      ratio: 0.5,
      verifiedHunks: 1,
      totalHunks: 2,
    });
    const v = toAdmissionVerdict(p);
    expect(v.reasons.some((r) => /Coverage only/.test(r.text))).toBe(true);
  });

  it("emits a reason for compliance fails", () => {
    const p = proof({
      atts: [att({ file: "a.ts", classification: "mechanical" })],
      ratio: 0.95,
      compliance: { pass: 5, fail: 2, unknown: 0, liesDetected: 0 },
    });
    const v = toAdmissionVerdict(p);
    expect(v.reasons.some((r) => /compliance rule/.test(r.text))).toBe(true);
  });

  it("generates one action per failing verifier, ordered by count desc", () => {
    const p = proof({
      atts: [
        att({
          file: "a.ts",
          classification: "new-behavior",
          checks: [
            { verifier: "taint", status: "fail" },
            { verifier: "behavior", status: "fail" },
          ],
        }),
        att({
          file: "b.ts",
          classification: "new-behavior",
          checks: [{ verifier: "taint", status: "fail" }],
        }),
      ],
      ratio: 0.95,
    });
    const v = toAdmissionVerdict(p);
    const fixActions = v.actions.filter((a) => a.text.startsWith("fix"));
    expect(fixActions).toHaveLength(2);
    // taint fails 2 times, behavior fails 1 time → taint first.
    expect(fixActions[0].text).toContain("taint");
    expect(fixActions[0].text).toContain("(2)");
    expect(fixActions[1].text).toContain("behavior");
    expect(fixActions[1].text).toContain("(1)");
  });

  it("adds Raise coverage action when ratio < 0.9", () => {
    const p = proof({
      atts: [att({ file: "a.ts", classification: "mechanical" })],
      ratio: 0.8,
    });
    expect(
      toAdmissionVerdict(p).actions.some((a) =>
        /Raise coverage/.test(a.text),
      ),
    ).toBe(true);
  });

  it("adds Address N risky hunks action when risky > 0", () => {
    const p = proof({
      atts: [
        att({ file: "a.ts", classification: "risky" }),
        att({ file: "b.ts", classification: "risky" }),
        att({ file: "c.ts", classification: "mechanical" }),
      ],
      ratio: 0.8,
    });
    const v = toAdmissionVerdict(p);
    expect(
      v.actions.some((a) => a.text === "Address 2 risky hunks"),
    ).toBe(true);
  });
});

describe("toAdmissionVerdict — outputs", () => {
  it("preserves coverage block and attestation order in hunks", () => {
    const p = proof({
      atts: [
        att({ file: "a.ts", classification: "mechanical", hunkHeader: "@@ -1,3 +1,3 @@" }),
        att({ file: "b.ts", classification: "risky", hunkHeader: "@@ -5,1 +5,1 @@" }),
      ],
      ratio: 0.5,
      verifiedHunks: 1,
      totalHunks: 2,
    });
    const v = toAdmissionVerdict(p);
    expect(v.coverage).toEqual({ verifiedHunks: 1, totalHunks: 2, ratio: 0.5 });
    expect(v.hunks).toHaveLength(2);
    expect(v.hunks[0].file).toBe("a.ts");
    expect(v.hunks[0].range).toBe("L1-3");
    expect(v.hunks[1].range).toBe("L5");
  });

  it("falls back to `PR <prId>` as changeLabel", () => {
    const p = proof({
      atts: [att({ file: "a.ts", classification: "mechanical" })],
      ratio: 1,
      prId: "gh:org/repo#42",
    });
    expect(toAdmissionVerdict(p).changeLabel).toBe("PR gh:org/repo#42");
  });

  it("honors opts.changeLabel", () => {
    const p = proof({
      atts: [att({ file: "a.ts", classification: "mechanical" })],
      ratio: 1,
    });
    expect(
      toAdmissionVerdict(p, { changeLabel: "Feature X" }).changeLabel,
    ).toBe("Feature X");
  });

  it("process contribution spikes when lies detected", () => {
    const p = proof({
      atts: [att({ file: "a.ts", classification: "mechanical" })],
      ratio: 0.95,
      compliance: { pass: 0, fail: 0, unknown: 0, liesDetected: 1 },
    });
    const v = toAdmissionVerdict(p);
    expect(v.contributions.process).toBe(80);
  });

  it("totalRisk is 0 for a perfect proof", () => {
    const p = proof({
      atts: [att({ file: "a.ts", classification: "mechanical" })],
      ratio: 1,
    });
    expect(toAdmissionVerdict(p).totalRisk).toBe(0);
  });

  it("totalRisk is clamped to [0, 100]", () => {
    const p = proof({
      atts: [att({ file: "a.ts", classification: "risky", checks: [{ verifier: "x", status: "fail" }] })],
      ratio: 0,
    });
    const v = toAdmissionVerdict(p);
    expect(v.totalRisk).toBeGreaterThanOrEqual(0);
    expect(v.totalRisk).toBeLessThanOrEqual(100);
  });
});
