import type { RefactorRoiResult } from "./refactor-roi";
import type { RefactorPlan } from "./refactor-suggestions";

// Projects the ROI terrain after applying a single plan. Deterministic,
// side-effect-free — the UI diff overlay and the cost readout in the
// Action Terrain share the output shape.

export interface RefactorSimulationResult {
  plan: RefactorPlan;
  before: {
    perFile: ReadonlyMap<string, number>;
    total: number;
  };
  after: {
    perFile: ReadonlyMap<string, number>;
    total: number;
  };
  terrainDelta: ReadonlyMap<string, number>;
  confidence: number;
}

function clampScore(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  if (x >= 100) return 100;
  return x;
}

export function simulateRefactor(
  roi: RefactorRoiResult,
  plan: RefactorPlan,
): RefactorSimulationResult {
  const before = new Map<string, number>();
  const after = new Map<string, number>();
  const delta = new Map<string, number>();

  for (const entry of roi.scores.values()) {
    before.set(entry.fileId, entry.score);
    after.set(entry.fileId, entry.score);
  }

  const applyTo = (id: string, deltaValue: number): void => {
    const prev = after.get(id);
    if (prev === undefined) return;
    const next = clampScore(prev + deltaValue);
    after.set(id, next);
  };

  applyTo(plan.fileId, plan.projectedRoiDelta);
  const couplingDelta = plan.projectedRoiDelta * 0.5;
  for (const peer of plan.affectedFileIds) {
    if (peer === plan.fileId) continue;
    applyTo(peer, couplingDelta);
  }

  let beforeTotal = 0;
  let afterTotal = 0;
  for (const [id, prev] of before) {
    const next = after.get(id) ?? prev;
    beforeTotal += prev;
    afterTotal += next;
    const d = next - prev;
    if (d !== 0) delta.set(id, d);
  }

  return {
    plan,
    before: { perFile: before, total: beforeTotal },
    after: { perFile: after, total: afterTotal },
    terrainDelta: delta,
    confidence: plan.confidence,
  };
}
