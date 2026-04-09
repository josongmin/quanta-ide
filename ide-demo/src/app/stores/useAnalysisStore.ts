import { create } from "zustand";
import { SYSTEM_RISK } from "@/entities/code/model/analysisData";

interface AnalysisState {
  riskScore: number;
  taintPaths: number;
  unsafeWrites: number;
  affectedFiles: number;
  blastRadius: number;
  isAnalyzing: boolean;
  lastChange: string | null;
  simulateEdit: (type: "widen-condition" | "remove-validate" | "add-import") => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  riskScore: SYSTEM_RISK.score,
  taintPaths: SYSTEM_RISK.taintPaths,
  unsafeWrites: SYSTEM_RISK.unsafeWrites,
  affectedFiles: SYSTEM_RISK.affectedFiles,
  blastRadius: 31,
  isAnalyzing: false,
  lastChange: null,

  simulateEdit: (type) => {
    set({ isAnalyzing: true });
    setTimeout(() => {
      switch (type) {
        case "widen-condition":
          set({
            riskScore: 78,
            blastRadius: 37,
            taintPaths: 6,
            affectedFiles: 37,
            isAnalyzing: false,
            lastChange: "blast radius: 31 → 37, taint path: +1",
          });
          break;
        case "remove-validate":
          set({
            riskScore: 85,
            blastRadius: 42,
            taintPaths: 8,
            unsafeWrites: 15,
            isAnalyzing: false,
            lastChange: "blast radius: 31 → 42, unsafe writes: +3",
          });
          break;
        case "add-import":
          set({
            isAnalyzing: false,
            lastChange: "New dependency detected — scanning CVE database...",
          });
          break;
      }
    }, 800);
  },

  reset: () =>
    set({
      riskScore: SYSTEM_RISK.score,
      taintPaths: SYSTEM_RISK.taintPaths,
      unsafeWrites: SYSTEM_RISK.unsafeWrites,
      affectedFiles: SYSTEM_RISK.affectedFiles,
      blastRadius: 31,
      isAnalyzing: false,
      lastChange: null,
    }),
}));
