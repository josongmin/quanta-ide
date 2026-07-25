import type { ObservabilityCoverage } from "../model/types";

const def: ObservabilityCoverage = {
  spans: [
    {
      symbol: "OrdersController.submit",
      file: "src/api/orders/controller.ts",
      startLine: 41,
      endLine: 78,
      critical: true,
      signals: { log: "covered", metric: "covered", trace: "covered", alert: "covered" },
      errorsObserved: 12,
      callsObserved: 12480,
      owner: "@checkout",
    },
    {
      symbol: "OrderService.placeV2",
      file: "src/domain/order/service.ts",
      startLine: 88,
      endLine: 165,
      critical: true,
      signals: { log: "covered", metric: "partial", trace: "covered", alert: "blind" },
      errorsObserved: 38,
      callsObserved: 12480,
      owner: "@checkout",
    },
    {
      symbol: "FraudClient.probe",
      file: "src/clients/fraud.ts",
      startLine: 12,
      endLine: 64,
      critical: true,
      signals: { log: "partial", metric: "blind", trace: "covered", alert: "blind" },
      errorsObserved: 7,
      callsObserved: 12100,
      owner: "@fraud",
    },
    {
      symbol: "OrderRepo.persist",
      file: "src/infra/db/order-repo.ts",
      startLine: 19,
      endLine: 58,
      critical: true,
      signals: { log: "blind", metric: "blind", trace: "covered", alert: "blind" },
      errorsObserved: 2,
      callsObserved: 12480,
      owner: "@checkout",
    },
    {
      symbol: "outbox.enqueue",
      file: "src/infra/outbox.ts",
      startLine: 12,
      endLine: 40,
      critical: true,
      signals: { log: "covered", metric: "covered", trace: "covered", alert: "covered" },
      errorsObserved: 0,
      callsObserved: 12476,
      owner: "@platform",
    },
    {
      symbol: "RankingService.score",
      file: "src/search/ranking.ts",
      startLine: 22,
      endLine: 91,
      critical: false,
      signals: { log: "blind", metric: "blind", trace: "blind", alert: "blind" },
      errorsObserved: 18,
      callsObserved: 312000,
      owner: "@ml",
    },
    {
      symbol: "AdminController.flushCache",
      file: "src/api/admin/controller.ts",
      startLine: 54,
      endLine: 81,
      critical: false,
      signals: { log: "covered", metric: "blind", trace: "blind", alert: "blind" },
      errorsObserved: 0,
      callsObserved: 8,
      owner: "@platform",
    },
  ],
};

export const OBSERVABILITY_COVERAGE: Record<string, ObservabilityCoverage> = { __default: def };

export function getObservabilityCoverage(fileName: string | undefined): ObservabilityCoverage {
  if (!fileName) return OBSERVABILITY_COVERAGE.__default;
  return OBSERVABILITY_COVERAGE[fileName] ?? OBSERVABILITY_COVERAGE.__default;
}
