export interface HotspotFile {
  id: string;
  file: string;
  commits30d: number;
  authors: number;
  churnLines: number;
  riskTrend: "rising" | "stable" | "falling";
  spark: number[];
}

const HOTSPOTS_BY_FILE: Record<string, HotspotFile[]> = {
  "orchestrator.py": [
    { id: "h1", file: "orchestrator.py", commits30d: 28, authors: 4, churnLines: 1240, riskTrend: "rising", spark: [0.3, 0.4, 0.5, 0.7, 0.8, 0.9, 1.0] },
    { id: "h2", file: "fee.ts", commits30d: 22, authors: 3, churnLines: 890, riskTrend: "rising", spark: [0.2, 0.3, 0.5, 0.6, 0.8, 0.7, 0.9] },
    { id: "h3", file: "webhook.ts", commits30d: 18, authors: 3, churnLines: 640, riskTrend: "stable", spark: [0.5, 0.6, 0.5, 0.5, 0.6, 0.5, 0.6] },
    { id: "h4", file: "retry.ts", commits30d: 15, authors: 2, churnLines: 410, riskTrend: "stable", spark: [0.4, 0.4, 0.3, 0.5, 0.4, 0.5, 0.4] },
    { id: "h5", file: "ledger.ts", commits30d: 12, authors: 2, churnLines: 320, riskTrend: "falling", spark: [0.8, 0.7, 0.5, 0.4, 0.3, 0.2, 0.2] },
  ],
  "routing_policy.py": [
    { id: "h6", file: "routing_policy.py", commits30d: 14, authors: 2, churnLines: 380, riskTrend: "stable", spark: [0.4, 0.5, 0.4, 0.4, 0.5, 0.4, 0.5] },
    { id: "h7", file: "gateway.py", commits30d: 8, authors: 1, churnLines: 140, riskTrend: "falling", spark: [0.5, 0.4, 0.3, 0.2, 0.2, 0.1, 0.1] },
  ],
  "security.py": [
    { id: "h8", file: "security.py", commits30d: 19, authors: 3, churnLines: 720, riskTrend: "rising", spark: [0.2, 0.3, 0.4, 0.5, 0.7, 0.8, 0.9] },
  ],
  "audit_store.py": [
    { id: "h9", file: "audit_store.py", commits30d: 3, authors: 1, churnLines: 40, riskTrend: "falling", spark: [0.3, 0.2, 0.1, 0.1, 0.1, 0.0, 0.0] },
  ],
};

export function getHotspots(fileName: string): HotspotFile[] {
  return HOTSPOTS_BY_FILE[fileName] ?? [];
}
