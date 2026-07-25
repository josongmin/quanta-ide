import type { FeatureFlag, FlagComboCell, FlagMap } from "../model/types";

/**
 * Helper — build the full 2^N truth table for a given flag order,
 * then let per-cell overrides customize reachability / coverage / risk / lines.
 * Iteration order is standard binary: flag[0] is the MSB of the bitstring.
 */
interface CellOverride {
  reachable?: boolean;
  covered?: FlagComboCell["covered"];
  riskScore?: number;
  activeLines?: number[];
  note?: string;
}

function buildCells(
  flagIds: readonly string[],
  overrides: Record<string, CellOverride>,
  baseline: Omit<CellOverride, "note"> & { activeLines: number[] },
): FlagComboCell[] {
  const total = 1 << flagIds.length;
  const cells: FlagComboCell[] = [];
  for (let i = 0; i < total; i++) {
    const bits: boolean[] = [];
    const combo: Record<string, boolean> = {};
    for (let b = 0; b < flagIds.length; b++) {
      // flag[0] is MSB so the bitstring reads left→right as flag order
      const on = ((i >> (flagIds.length - 1 - b)) & 1) === 1;
      bits.push(on);
      combo[flagIds[b]] = on;
    }
    const key = bits.map((x) => (x ? "1" : "0")).join("");
    const ov = overrides[key] ?? {};
    cells.push({
      combo,
      reachable: ov.reachable ?? baseline.reachable ?? true,
      covered: ov.covered ?? baseline.covered ?? "covered",
      riskScore: ov.riskScore ?? baseline.riskScore ?? 20,
      activeLines: ov.activeLines ?? baseline.activeLines,
      note: ov.note,
    });
  }
  return cells;
}

/* ─── orchestrator.py — showcase: 4 flags × 16 cells ─────────────── */
const ORCHESTRATOR_FLAGS: FeatureFlag[] = [
  { id: "enable_deep_v2",      label: "Deep Reasoning v2",   owner: "@songmin", default: true,  stage: "canary",     ageDays: 21 },
  { id: "fast_path",           label: "Fast Path",           owner: "@jina",    default: false, stage: "prod",       ageDays: 180 },
  { id: "trace_retention_ext", label: "Extended Trace Ret.", owner: "@haru",    default: false, stage: "dev",        ageDays: 7 },
  { id: "legacy_router",       label: "Legacy Router",       owner: "@songmin", default: false, stage: "deprecated", ageDays: 412 },
];

const ORCHESTRATOR_CELLS = buildCells(
  ORCHESTRATOR_FLAGS.map((f) => f.id),
  {
    // bitstring: enable_deep_v2 fast_path trace_retention_ext legacy_router
    "0000": { covered: "covered",   riskScore: 18, activeLines: [42, 55, 88],                note: "all-off baseline" },
    "0001": { covered: "partial",   riskScore: 54, activeLines: [42, 210, 244],              note: "legacy-only path" },
    "0010": { covered: "covered",   riskScore: 22, activeLines: [42, 55, 88, 301] },
    "0011": { reachable: false,     covered: "uncovered", riskScore: 0,  activeLines: [],    note: "legacy + new trace retention — mutually exclusive" },
    "0100": { covered: "covered",   riskScore: 31, activeLines: [42, 120, 155] },
    "0101": { covered: "uncovered", riskScore: 72, activeLines: [42, 120, 210, 244],         note: "fast_path + legacy never tested" },
    "0110": { covered: "partial",   riskScore: 44, activeLines: [42, 120, 155, 301] },
    "0111": { reachable: false,     covered: "uncovered", riskScore: 0,  activeLines: [] },
    "1000": { covered: "covered",   riskScore: 28, activeLines: [42, 55, 88, 402] },
    "1001": { covered: "partial",   riskScore: 61, activeLines: [42, 210, 244, 402] },
    "1010": { covered: "covered",   riskScore: 36, activeLines: [42, 55, 88, 301, 402] },
    "1011": { reachable: false,     covered: "uncovered", riskScore: 0,  activeLines: [],    note: "v2 + legacy — build-time guard" },
    "1100": { covered: "covered",   riskScore: 41, activeLines: [42, 120, 155, 402] },
    "1101": { covered: "uncovered", riskScore: 88, activeLines: [42, 120, 210, 244, 402],    note: "deep v2 + fast_path + legacy — prod incident risk" },
    "1110": { covered: "partial",   riskScore: 58, activeLines: [42, 120, 155, 301, 402] },
    "1111": { reachable: false,     covered: "uncovered", riskScore: 0,  activeLines: [] },
  },
  { reachable: true, covered: "covered", riskScore: 20, activeLines: [42] },
);

/* ─── routing_policy.py — 3 flags × 8 cells, includes deprecated ─── */
const ROUTING_FLAGS: FeatureFlag[] = [
  { id: "shard_aware",    label: "Shard-Aware Routing",  owner: "@haru",    default: true,  stage: "prod",       ageDays: 95 },
  { id: "retry_on_5xx",   label: "Retry on 5xx",         owner: "@jina",    default: true,  stage: "prod",       ageDays: 240 },
  { id: "hash_fallback",  label: "Hash Fallback (old)",  owner: "@songmin", default: false, stage: "deprecated", ageDays: 530 },
];

const ROUTING_CELLS = buildCells(
  ROUTING_FLAGS.map((f) => f.id),
  {
    "000": { covered: "partial",   riskScore: 38, activeLines: [14, 52],                     note: "no routing strategy — degrades to round-robin" },
    "001": { covered: "uncovered", riskScore: 66, activeLines: [14, 52, 140],                note: "only deprecated fallback active" },
    "010": { covered: "covered",   riskScore: 20, activeLines: [14, 52, 88] },
    "011": { covered: "partial",   riskScore: 48, activeLines: [14, 52, 88, 140] },
    "100": { covered: "covered",   riskScore: 24, activeLines: [14, 52, 176] },
    "101": { reachable: false,     covered: "uncovered", riskScore: 0,  activeLines: [],     note: "shard_aware overrides hash_fallback at init" },
    "110": { covered: "covered",   riskScore: 30, activeLines: [14, 52, 88, 176] },
    "111": { reachable: false,     covered: "uncovered", riskScore: 0,  activeLines: [] },
  },
  { reachable: true, covered: "covered", riskScore: 20, activeLines: [14] },
);

/* ─── security.py — 3 flags × 8 cells, one critical uncovered combo ─ */
const SECURITY_FLAGS: FeatureFlag[] = [
  { id: "strict_mtls",      label: "Strict mTLS",          owner: "@songmin", default: true,  stage: "prod",   ageDays: 320 },
  { id: "allow_guest_read", label: "Allow Guest Read",     owner: "@jina",    default: false, stage: "canary", ageDays: 11 },
  { id: "token_rebind",     label: "Token Rebind (exp.)",  owner: "@haru",    default: false, stage: "dev",    ageDays: 4 },
];

const SECURITY_CELLS = buildCells(
  SECURITY_FLAGS.map((f) => f.id),
  {
    "000": { covered: "partial",   riskScore: 52, activeLines: [21, 77],                     note: "mTLS disabled — staging-only fallback" },
    "001": { covered: "uncovered", riskScore: 92, activeLines: [21, 77, 188],                note: "CRITICAL — no mTLS + experimental rebind path" },
    "010": { covered: "uncovered", riskScore: 81, activeLines: [21, 77, 132],                note: "guest read without mTLS — data exposure" },
    "011": { reachable: false,     covered: "uncovered", riskScore: 0,  activeLines: [] },
    "100": { covered: "covered",   riskScore: 12, activeLines: [21, 77, 240] },
    "101": { covered: "partial",   riskScore: 44, activeLines: [21, 77, 188, 240] },
    "110": { covered: "covered",   riskScore: 28, activeLines: [21, 77, 132, 240] },
    "111": { covered: "partial",   riskScore: 58, activeLines: [21, 77, 132, 188, 240] },
  },
  { reachable: true, covered: "covered", riskScore: 20, activeLines: [21] },
);

export const FLAG_MAPS: Record<string, FlagMap> = {
  "orchestrator.py":   { flags: ORCHESTRATOR_FLAGS, cells: ORCHESTRATOR_CELLS },
  "routing_policy.py": { flags: ROUTING_FLAGS,      cells: ROUTING_CELLS },
  "security.py":       { flags: SECURITY_FLAGS,     cells: SECURITY_CELLS },
};

export function getFlagMap(fileName: string): FlagMap | null {
  return FLAG_MAPS[fileName] ?? null;
}
