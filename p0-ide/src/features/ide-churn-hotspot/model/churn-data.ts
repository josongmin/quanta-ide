export interface HotspotFile {
  id: string;
  file: string;
  commits30d: number;
  authors: number;
  churnLines: number;
  riskTrend: "rising" | "stable" | "falling";
  /** 7-day mini sparkline (0-1 normalized) */
  spark: number[];
}

export const HOTSPOT_FILES: HotspotFile[] = [
  { id: "h1", file: "orchestrator.py", commits30d: 28, authors: 4, churnLines: 1240, riskTrend: "rising", spark: [0.3, 0.4, 0.5, 0.7, 0.8, 0.9, 1.0] },
  { id: "h2", file: "fee.ts", commits30d: 22, authors: 3, churnLines: 890, riskTrend: "rising", spark: [0.2, 0.3, 0.5, 0.6, 0.8, 0.7, 0.9] },
  { id: "h3", file: "webhook.ts", commits30d: 18, authors: 3, churnLines: 640, riskTrend: "stable", spark: [0.5, 0.6, 0.5, 0.5, 0.6, 0.5, 0.6] },
  { id: "h4", file: "retry.ts", commits30d: 15, authors: 2, churnLines: 410, riskTrend: "stable", spark: [0.4, 0.4, 0.3, 0.5, 0.4, 0.5, 0.4] },
  { id: "h5", file: "ledger.ts", commits30d: 12, authors: 2, churnLines: 320, riskTrend: "falling", spark: [0.8, 0.7, 0.5, 0.4, 0.3, 0.2, 0.2] },
  { id: "h6", file: "billing.ts", commits30d: 9, authors: 2, churnLines: 210, riskTrend: "falling", spark: [0.6, 0.5, 0.4, 0.3, 0.3, 0.2, 0.1] },
  { id: "h7", file: "config.ts", commits30d: 6, authors: 1, churnLines: 80, riskTrend: "stable", spark: [0.1, 0.2, 0.1, 0.1, 0.2, 0.1, 0.1] },
];
