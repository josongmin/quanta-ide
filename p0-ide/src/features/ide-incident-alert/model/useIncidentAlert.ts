import { create } from "zustand";

export interface IncidentMatch {
  id: string;
  title: string;
  date: string;
  severity: "P0" | "P1" | "P2";
  similarity: number;
  rootCause: string;
  pattern: string[];
  confidence: "low" | "medium" | "high";
}

interface IncidentAlertState {
  match: IncidentMatch | null;
  dismissed: Set<string>;
  show: (match: IncidentMatch) => void;
  hide: () => void;
  ignore: (id: string) => void;
}

export const SAMPLE_MATCH: IncidentMatch = {
  id: "INC-2024-0312",
  title: "double refund via retry loop",
  date: "2024-03-12",
  severity: "P0",
  similarity: 87,
  rootCause: "retry loop missing idempotency key",
  pattern: [
    "retry loop detected",
    "no idempotency check",
    "DB write inside loop",
  ],
  confidence: "high",
};

export const useIncidentAlert = create<IncidentAlertState>()((set) => ({
  match: null,
  dismissed: new Set(),
  show: (match) => {
    set((s) => (s.dismissed.has(match.id) ? s : { match }));
  },
  hide: () => { set({ match: null }); },
  ignore: (id) => {
    set((s) => {
      const next = new Set(s.dismissed);
      next.add(id);
      return { dismissed: next, match: null };
    });
  },
}));
