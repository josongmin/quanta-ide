import type {
  HorizonDays,
  MetricId,
  Projection,
  ProjectionInput,
  ScenarioId,
  Trajectory,
  TrajectoryPoint,
} from "./types";

/**
 * Mock projector. In production this would delegate to historical-signal
 * analysis + incident DNA model. For the UI-only build we compute
 * deterministic parametric curves per metric per scenario so the graph
 * reads like real forecasting with confidence bands.
 */

function sampleDays(horizon: HorizonDays): number[] {
  const steps = Math.min(horizon, 16);
  const days: number[] = [];
  for (let i = 0; i <= steps; i++) {
    days.push(Math.round((i / steps) * horizon));
  }
  return Array.from(new Set(days));
}

type CurveFn = (day: number, horizon: number) => number;

type MetricCurveSet = {
  base: number;
  apply: { endpoint: number; shape: CurveFn; bandPct: number };
  dismiss: { endpoint: number; shape: CurveFn; bandPct: number };
};

function linearRamp(start: number, end: number): CurveFn {
  return (day, h) => start + (end - start) * (day / h);
}

function stepThenFlat(drop: number, drift: number): CurveFn {
  return (day, _h) => {
    if (day <= 0) return drop;
    return drop + drift * Math.log(1 + day);
  };
}

function exponentialGrowth(start: number, k: number): CurveFn {
  return (day, _h) => start + start * (Math.exp(k * day) - 1) * 0.05;
}

function decayDown(start: number, end: number): CurveFn {
  return (day, h) => end + (start - end) * Math.exp(-3 * (day / h));
}

const CURVES: Record<MetricId, (input: ProjectionInput) => MetricCurveSet> = {
  risk: (input) => ({
    base: input.currentRisk,
    apply:   { endpoint: 12, shape: stepThenFlat(12, 1.5), bandPct: 0.08 },
    dismiss: { endpoint: input.currentRisk + 30, shape: linearRamp(input.currentRisk, input.currentRisk + 30), bandPct: 0.16 },
  }),
  blast: (input) => ({
    base: input.currentBlast,
    apply:   { endpoint: 2, shape: stepThenFlat(2, 0.3), bandPct: 0.1 },
    dismiss: { endpoint: input.currentBlast + 14, shape: linearRamp(input.currentBlast, input.currentBlast + 14), bandPct: 0.18 },
  }),
  cpx: (input) => ({
    base: input.currentCpx,
    apply:   { endpoint: input.currentCpx - 1, shape: stepThenFlat(input.currentCpx - 1, 0.05), bandPct: 0.05 },
    dismiss: { endpoint: input.currentCpx + 2, shape: linearRamp(input.currentCpx, input.currentCpx + 2), bandPct: 0.12 },
  }),
  coverage: (input) => ({
    base: input.currentCoverage,
    apply:   { endpoint: 82, shape: stepThenFlat(82, 0.2), bandPct: 0.04 },
    dismiss: { endpoint: Math.max(0, input.currentCoverage - 8), shape: decayDown(input.currentCoverage, Math.max(0, input.currentCoverage - 8)), bandPct: 0.14 },
  }),
  incident: (_input) => ({
    base: 0.03,
    apply:   { endpoint: 0.008, shape: stepThenFlat(0.008, 0.0005), bandPct: 0.25 },
    dismiss: { endpoint: 0.45,  shape: exponentialGrowth(0.03, 0.14), bandPct: 0.35 },
  }),
};

function buildTrajectory(
  metric: MetricId,
  scenario: ScenarioId,
  curve: MetricCurveSet,
  horizon: HorizonDays,
): Trajectory {
  const spec = scenario === "apply" ? curve.apply : curve.dismiss;
  const days = sampleDays(horizon);
  const points: TrajectoryPoint[] = days.map((d) => {
    const median = spec.shape(d, horizon);
    const band = Math.abs(median) * spec.bandPct;
    return {
      day: d,
      median,
      low: median - band,
      high: median + band,
    };
  });
  // Pin day 0 to the base (both scenarios start from current state)
  if (points.length > 0) {
    points[0] = { day: 0, median: curve.base, low: curve.base, high: curve.base };
  }
  return {
    metric,
    scenario,
    points,
    model: scenario === "apply" ? "stable-post-apply" : "linear-growth + incident-weighted",
  };
}

export function project(input: ProjectionInput): Projection {
  const metrics: MetricId[] = ["risk", "blast", "cpx", "coverage", "incident"];
  const trajectoriesByMetric = {} as Projection["trajectoriesByMetric"];
  for (const m of metrics) {
    const curve = CURVES[m](input);
    trajectoriesByMetric[m] = {
      apply: buildTrajectory(m, "apply", curve, input.horizonDays),
      dismiss: buildTrajectory(m, "dismiss", curve, input.horizonDays),
    };
  }

  return {
    input,
    trajectoriesByMetric,
    predictedIncidents: [
      {
        id: "pi-412",
        shapeMatchId: "INC-412",
        similarity: 0.91,
        likelyWithinDays: 11,
        reason: "unvalidated trace forwarded to persistence sink — matches INC-412 shape",
        engineSource: "incident DNA",
      },
      {
        id: "pi-47",
        shapeMatchId: "INC-47",
        similarity: 0.87,
        likelyWithinDays: 23,
        reason: "ExperienceStore null-trace on retry path",
        engineSource: "incident DNA",
      },
    ],
    predictedCascade: [
      { symbol: "Tracer.emit",          layer: "infra",  weight: 0.88, critical: true,  reason: "outgoing edge from sink" },
      { symbol: "auth.session.create",  layer: "domain", weight: 0.71, critical: true,  reason: "consumes trace envelope" },
      { symbol: "ReplayService.replay", layer: "app",    weight: 0.62, critical: false, reason: "reads raw persisted trace" },
      { symbol: "AuditStore.snapshot",  layer: "infra",  weight: 0.48, critical: false, reason: "mirrors save path" },
      { symbol: "billing.rate_quote",   layer: "domain", weight: 0.33, critical: false, reason: "indirect cpx growth" },
    ],
    costs: {
      apply:   { scenario: "apply",   low: 0.2, median: 0.3, high: 0.5 },
      dismiss: { scenario: "dismiss", low: 1.8, median: 3.5, high: 5.2 },
    },
    historicalAnalog: {
      id: "ha-289",
      when: "3 months ago",
      where: "payment_svc.reconcile()",
      similar: "unvalidated amount envelope reached ledger.write",
      outcome: "dismissed → INC-289 fired 19 days later, 5 engineer-days to remediate",
      costDays: 5,
    },
  };
}
