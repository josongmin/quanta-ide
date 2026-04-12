import { create } from "zustand";

export interface ImpactedFile {
  name: string;
  severity: "critical" | "high" | "medium" | "low";
  reason: string;
}

export interface PropagationStep {
  order: number;
  label: string;
}

export interface ChangeImpactData {
  /** line number where impact originates */
  originLine: number;
  /** function name at the origin */
  originFn: string;
  /** overall risk score 0–100 */
  riskScore: number;
  /** number of files affected */
  files: number;
  /** number of functions affected */
  functions: number;
  /** number of APIs affected */
  apis: number;
  /** number of tests affected */
  tests: number;
  /** blast radius confidence 0–1 */
  confidence: number;
  /** one-line summary for the editor banner */
  summary: string;
  /** propagation order */
  propagation: PropagationStep[];
  /** top impacted files */
  topFiles: ImpactedFile[];
}

interface ChangeImpactState {
  data: ChangeImpactData | null;
  isActive: boolean;
  show: (data: ChangeImpactData) => void;
  hide: () => void;
  toggle: (data: ChangeImpactData) => void;
}

export const useChangeImpact = create<ChangeImpactState>((set, get) => ({
  data: null,
  isActive: false,
  show: (data) => { set({ data, isActive: true }); },
  hide: () => { set({ isActive: false }); },
  toggle: (data) => {
    const { isActive } = get();
    if (isActive) set({ isActive: false });
    else set({ data, isActive: true });
  },
}));
