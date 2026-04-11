import { create } from "zustand";

export interface RadarItem {
  id: string;
  kind: "review" | "risk" | "stale" | "gap";
  title: string;
  meta: string;
  badge: string;
  severity: 1 | 2 | 3 | 4;
}

interface ReviewRadarState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export const useReviewRadar = create<ReviewRadarState>()((set) => ({
  isOpen: true,
  toggle: () => { set((s) => ({ isOpen: !s.isOpen })); },
  close: () => { set({ isOpen: false }); },
}));

export const RADAR_GROUPS: { kind: RadarItem["kind"]; items: RadarItem[] }[] = [
  {
    kind: "review",
    items: [
      { id: "pr-481", kind: "review", title: "PR #481 — Refund retry idempotency", meta: "@bob · payments-api · +312/-48", badge: "3", severity: 3 },
      { id: "pr-479", kind: "review", title: "PR #479 — Webhook signature rotation", meta: "@dana · webhooks · +84/-12", badge: "3", severity: 2 },
      { id: "pr-475", kind: "review", title: "PR #475 — Ledger compaction", meta: "@erin · ledger · +1.2k/-340", badge: "3", severity: 4 },
    ],
  },
  {
    kind: "risk",
    items: [
      { id: "risk-1", kind: "risk", title: "PR #481 — blast radius +18 since yesterday", meta: "now touches 41 files (was 23)", badge: "1", severity: 4 },
    ],
  },
  {
    kind: "stale",
    items: [
      { id: "stale-1", kind: "stale", title: "feat/replay-protection — 21 days idle", meta: "@frank · 3 commits behind main", badge: "12", severity: 2 },
    ],
  },
  {
    kind: "gap",
    items: [
      { id: "gap-1", kind: "gap", title: "sendWebhook() — orphan", meta: "no current owner · last author left org", badge: "2", severity: 3 },
    ],
  },
];
