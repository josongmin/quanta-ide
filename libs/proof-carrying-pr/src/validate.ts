// Hand-rolled runtime validator for ProofCarryingPR. No zod — the schema is
// small and stable enough that a dependency-free walker is cheaper than a
// framework. The validator collects *all* errors (not just the first) so
// tooling can surface a full list in a single pass.
//
// Error paths use JSON-pointer-ish strings:
//   "$"                                 — the root value itself
//   "coverage.ratio"                    — object property
//   "attestations[2].classification"    — array element property
//   "attestations[0].checks[1].status"  — nested array element
//
// The dollar-sign root is reused for "top-level shape is wrong" errors
// (e.g. input is null or a string).

import type {
  HunkAttestation,
  HunkCheck,
  HunkClassification,
  ProjectionSummary,
  ProofCarryingPR,
  VerifierStatus,
} from "./types";

/**
 * Single validation failure. `path` is a human-readable pointer into the
 * input document; `reason` is a short explanation suitable for UI display.
 */
export interface ValidationError {
  path: string;
  reason: string;
}

const CLASSIFICATIONS: readonly HunkClassification[] = [
  "mechanical",
  "logic-preserved",
  "new-behavior",
  "risky",
];

const STATUSES: readonly VerifierStatus[] = ["pass", "fail", "unknown"];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

function requireString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: ValidationError[],
): string | null {
  const v = obj[key];
  if (!isString(v)) {
    errors.push({ path: `${path}${key}`, reason: "expected string" });
    return null;
  }
  return v;
}

function requireFiniteNumber(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: ValidationError[],
): number | null {
  const v = obj[key];
  if (!isNumber(v)) {
    errors.push({ path: `${path}${key}`, reason: "expected finite number" });
    return null;
  }
  return v;
}

function requireNonNegativeNumber(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: ValidationError[],
): number | null {
  const v = requireFiniteNumber(obj, key, path, errors);
  if (v === null) return null;
  if (v < 0) {
    errors.push({ path: `${path}${key}`, reason: "must be >= 0" });
    return null;
  }
  return v;
}

function requireNonNegativeInt(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: ValidationError[],
): number | null {
  const v = requireNonNegativeNumber(obj, key, path, errors);
  if (v === null) return null;
  if (!Number.isInteger(v)) {
    errors.push({ path: `${path}${key}`, reason: "must be an integer" });
    return null;
  }
  return v;
}

function requireBoolean(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: ValidationError[],
): boolean | null {
  const v = obj[key];
  if (!isBoolean(v)) {
    errors.push({ path: `${path}${key}`, reason: "expected boolean" });
    return null;
  }
  return v;
}

function requireArray(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: ValidationError[],
): unknown[] | null {
  const v = obj[key];
  if (!Array.isArray(v)) {
    errors.push({ path: `${path}${key}`, reason: "expected array" });
    return null;
  }
  return v;
}

function validateCheck(
  raw: unknown,
  path: string,
  errors: ValidationError[],
): HunkCheck | null {
  if (!isObject(raw)) {
    errors.push({ path, reason: "expected object" });
    return null;
  }
  const prefix = `${path}.`;
  const verifier = requireString(raw, "verifier", prefix, errors);
  const statusRaw = raw["status"];
  let status: VerifierStatus | null = null;
  if (!isString(statusRaw) || !(STATUSES as readonly string[]).includes(statusRaw)) {
    errors.push({
      path: `${prefix}status`,
      reason: `expected one of ${STATUSES.join(", ")}`,
    });
  } else {
    status = statusRaw as VerifierStatus;
  }
  let detail: string | undefined;
  if (raw["detail"] !== undefined) {
    if (!isString(raw["detail"])) {
      errors.push({ path: `${prefix}detail`, reason: "expected string" });
    } else {
      detail = raw["detail"];
    }
  }
  if (verifier === null || status === null) return null;
  return detail === undefined
    ? { verifier, status }
    : { verifier, status, detail };
}

function validateRisk(
  raw: unknown,
  path: string,
  errors: ValidationError[],
): { before: number; after: number } | null {
  if (!isObject(raw)) {
    errors.push({ path, reason: "expected object" });
    return null;
  }
  const prefix = `${path}.`;
  const before = requireFiniteNumber(raw, "before", prefix, errors);
  const after = requireFiniteNumber(raw, "after", prefix, errors);
  if (before === null || after === null) return null;
  return { before, after };
}

function validateAttestation(
  raw: unknown,
  path: string,
  errors: ValidationError[],
): HunkAttestation | null {
  if (!isObject(raw)) {
    errors.push({ path, reason: "expected object" });
    return null;
  }
  const prefix = `${path}.`;
  const file = requireString(raw, "file", prefix, errors);
  const hunkHeader = requireString(raw, "hunkHeader", prefix, errors);
  const verified = requireBoolean(raw, "verified", prefix, errors);

  const checksRaw = requireArray(raw, "checks", prefix, errors);
  const checks: HunkCheck[] = [];
  if (checksRaw) {
    for (let i = 0; i < checksRaw.length; i++) {
      const check = validateCheck(checksRaw[i], `${prefix}checks[${i}]`, errors);
      if (check) checks.push(check);
    }
  }

  const risk = validateRisk(raw["risk"], `${prefix}risk`, errors);
  if (raw["risk"] === undefined) {
    errors.push({ path: `${prefix}risk`, reason: "expected object" });
  }

  const classificationRaw = raw["classification"];
  let classification: HunkClassification | null = null;
  if (
    !isString(classificationRaw) ||
    !(CLASSIFICATIONS as readonly string[]).includes(classificationRaw)
  ) {
    errors.push({
      path: `${prefix}classification`,
      reason: `expected one of ${CLASSIFICATIONS.join(", ")}`,
    });
  } else {
    classification = classificationRaw as HunkClassification;
  }

  if (
    file === null ||
    hunkHeader === null ||
    verified === null ||
    !risk ||
    classification === null ||
    checksRaw === null
  ) {
    return null;
  }
  return {
    file,
    hunkHeader,
    verified,
    checks,
    risk,
    classification,
  };
}

function validateProjection(
  raw: unknown,
  path: string,
  errors: ValidationError[],
): ProjectionSummary | null {
  if (!isObject(raw)) {
    errors.push({ path, reason: "expected object" });
    return null;
  }
  const prefix = `${path}.`;
  const cost = requireNonNegativeNumber(raw, "cost", prefix, errors);
  const unitRaw = raw["unit"];
  let unit: "eng-days" | null = null;
  if (unitRaw !== "eng-days") {
    errors.push({ path: `${prefix}unit`, reason: 'expected "eng-days"' });
  } else {
    unit = "eng-days";
  }
  let delta: number | undefined;
  if (raw["delta"] !== undefined) {
    if (!isNumber(raw["delta"])) {
      errors.push({ path: `${prefix}delta`, reason: "expected finite number" });
    } else {
      delta = raw["delta"];
    }
  }
  if (cost === null || unit === null) return null;
  return delta === undefined ? { cost, unit } : { cost, unit, delta };
}

function validateStringRecord(
  raw: unknown,
  path: string,
  errors: ValidationError[],
): Record<string, string> | null {
  if (!isObject(raw)) {
    errors.push({ path, reason: "expected object" });
    return null;
  }
  const out: Record<string, string> = {};
  let ok = true;
  for (const key of Object.keys(raw)) {
    const v = raw[key];
    if (!isString(v)) {
      errors.push({ path: `${path}.${key}`, reason: "expected string" });
      ok = false;
      continue;
    }
    out[key] = v;
  }
  return ok ? out : null;
}

function validateGenerator(
  raw: unknown,
  path: string,
  errors: ValidationError[],
): ProofCarryingPR["generator"] | null {
  if (!isObject(raw)) {
    errors.push({ path, reason: "expected object" });
    return null;
  }
  const prefix = `${path}.`;
  const engineVersion = requireString(raw, "engineVersion", prefix, errors);
  const verifierVersions = validateStringRecord(
    raw["verifierVersions"],
    `${prefix}verifierVersions`,
    errors,
  );
  if (raw["verifierVersions"] === undefined) {
    // already reported as missing by the walker above? No — validateStringRecord
    // reports "expected object" on undefined. Fine.
  }
  if (engineVersion === null || verifierVersions === null) return null;
  return { engineVersion, verifierVersions };
}

function validateCoverage(
  raw: unknown,
  path: string,
  errors: ValidationError[],
): ProofCarryingPR["coverage"] | null {
  if (!isObject(raw)) {
    errors.push({ path, reason: "expected object" });
    return null;
  }
  const prefix = `${path}.`;
  const totalHunks = requireNonNegativeInt(raw, "totalHunks", prefix, errors);
  const verifiedHunks = requireNonNegativeInt(raw, "verifiedHunks", prefix, errors);
  const ratio = requireFiniteNumber(raw, "ratio", prefix, errors);
  if (ratio !== null && (ratio < 0 || ratio > 1)) {
    errors.push({ path: `${prefix}ratio`, reason: "must be in [0, 1]" });
  }
  if (
    totalHunks !== null &&
    verifiedHunks !== null &&
    verifiedHunks > totalHunks
  ) {
    errors.push({
      path: `${prefix}verifiedHunks`,
      reason: "must be <= totalHunks",
    });
  }
  if (
    totalHunks === null ||
    verifiedHunks === null ||
    ratio === null ||
    ratio < 0 ||
    ratio > 1
  ) {
    return null;
  }
  return { totalHunks, verifiedHunks, ratio };
}

function validateComplianceSummary(
  raw: unknown,
  path: string,
  errors: ValidationError[],
): ProofCarryingPR["complianceSummary"] | null {
  if (!isObject(raw)) {
    errors.push({ path, reason: "expected object" });
    return null;
  }
  const prefix = `${path}.`;
  const pass = requireNonNegativeInt(raw, "pass", prefix, errors);
  const fail = requireNonNegativeInt(raw, "fail", prefix, errors);
  const unknown = requireNonNegativeInt(raw, "unknown", prefix, errors);
  const liesDetected = requireNonNegativeInt(raw, "liesDetected", prefix, errors);
  if (
    pass === null ||
    fail === null ||
    unknown === null ||
    liesDetected === null
  ) {
    return null;
  }
  return { pass, fail, unknown, liesDetected };
}

function validateCounterfactuals(
  raw: unknown,
  path: string,
  errors: ValidationError[],
): ProofCarryingPR["counterfactuals"] | null {
  if (!isObject(raw)) {
    errors.push({ path, reason: "expected object" });
    return null;
  }
  const prefix = `${path}.`;
  const apply = validateProjection(raw["apply"], `${prefix}apply`, errors);
  if (raw["apply"] === undefined) {
    // Already reported by validateProjection seeing undefined as non-object.
  }
  const dismiss = validateProjection(raw["dismiss"], `${prefix}dismiss`, errors);
  if (apply === null || dismiss === null) return null;
  return { apply, dismiss };
}

function validateStringArray(
  raw: unknown,
  path: string,
  errors: ValidationError[],
): string[] | null {
  if (!Array.isArray(raw)) {
    errors.push({ path, reason: "expected array" });
    return null;
  }
  const out: string[] = [];
  let ok = true;
  for (let i = 0; i < raw.length; i++) {
    if (!isString(raw[i])) {
      errors.push({ path: `${path}[${i}]`, reason: "expected string" });
      ok = false;
      continue;
    }
    out.push(raw[i] as string);
  }
  return ok ? out : null;
}

/**
 * Validate an untrusted value against the {@link ProofCarryingPR} schema.
 *
 * Returns *all* errors discovered (not just the first), making this
 * suitable for surfacing a batch of complaints in CI output or the PR
 * dashboard.
 *
 * @example
 * const result = validateProof(JSON.parse(fs.readFileSync(".quanta-proof.json", "utf8")));
 * if (!result.ok) throw new Error(result.errors.map(e => `${e.path}: ${e.reason}`).join("\n"));
 */
export function validateProof(
  input: unknown,
): { ok: true; proof: ProofCarryingPR } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  if (!isObject(input)) {
    return { ok: false, errors: [{ path: "$", reason: "expected object" }] };
  }
  const root = input;
  const prefix = "";

  const prId = requireString(root, "prId", prefix, errors);
  const commitSha = requireString(root, "commitSha", prefix, errors);
  const generatedAt = requireFiniteNumber(root, "generatedAt", prefix, errors);
  const signature = requireString(root, "signature", prefix, errors);

  const generator = validateGenerator(root["generator"], "generator", errors);
  const coverage = validateCoverage(root["coverage"], "coverage", errors);
  const counterfactuals = validateCounterfactuals(
    root["counterfactuals"],
    "counterfactuals",
    errors,
  );
  const complianceSummary = validateComplianceSummary(
    root["complianceSummary"],
    "complianceSummary",
    errors,
  );

  const attestationsRaw = requireArray(root, "attestations", prefix, errors);
  const attestations: HunkAttestation[] = [];
  if (attestationsRaw) {
    for (let i = 0; i < attestationsRaw.length; i++) {
      const att = validateAttestation(
        attestationsRaw[i],
        `attestations[${i}]`,
        errors,
      );
      if (att) attestations.push(att);
    }
  }

  const patchTrailRefs = validateStringArray(
    root["patchTrailRefs"],
    "patchTrailRefs",
    errors,
  );

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Narrowed — every required piece is present.
  const proof: ProofCarryingPR = {
    prId: prId as string,
    commitSha: commitSha as string,
    generatedAt: generatedAt as number,
    generator: generator as ProofCarryingPR["generator"],
    coverage: coverage as ProofCarryingPR["coverage"],
    attestations,
    counterfactuals: counterfactuals as ProofCarryingPR["counterfactuals"],
    complianceSummary: complianceSummary as ProofCarryingPR["complianceSummary"],
    patchTrailRefs: patchTrailRefs as string[],
    signature: signature as string,
  };
  return { ok: true, proof };
}
