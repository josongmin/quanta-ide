import { useEffect, useRef } from "react";
import { useCommandPalette, registerCommand, unregisterCommand, setSuggestedProposalResolver } from "@/features/ide-command-palette";
import { useSimulateChange } from "@/features/ide-simulate-change";
import { useTimeTravel } from "@/features/ide-time-travel";
import { useFlowTrace, MOCK_TRACE } from "@/features/ide-flow-trace";
import { useAgentWindow } from "@/features/ide-agent-window";
import { useSemanticPr } from "@/features/ide-semantic-pr";
import { usePrDisaster } from "@/features/ide-pr-disaster";
import { useOwnershipMap } from "@/features/ide-ownership-map";
import { useChangeCard } from "@/features/ide-change-card";
import { useChangeImpact, SAMPLE_IMPACT } from "@/features/ide-change-impact";
import type { InspectorContext } from "@/features/ide-inspector-context";
import type { FixContent } from "./mock-fixes";

export interface UseIdeCommandsDeps {
  inspCtx: InspectorContext;
  active: string;
  setFileContext: (name: string) => void;
  setImpactContext: () => void;
  fix: FixContent;
}

export function useIdeCommands(deps: UseIdeCommandsDeps) {
  const { inspCtx, active, setFileContext, setImpactContext, fix } = deps;

  // Refs for frequently-changing values so command registration doesn't re-run
  const inspCtxRef = useRef(inspCtx);
  const activeRef = useRef(active);
  const setFileContextRef = useRef(setFileContext);

  inspCtxRef.current = inspCtx;
  activeRef.current = active;
  setFileContextRef.current = setFileContext;

  const toggleAgent = useAgentWindow((s) => s.toggle);
  const toggleCmdK = useCommandPalette((s) => s.toggle);
  const openCmdK = useCommandPalette((s) => s.open);
  const toggleSim = useSimulateChange((s) => s.toggle);
  const openSim = useSimulateChange((s) => s.open);
  const toggleTime = useTimeTravel((s) => s.toggle);
  const toggleTrace = useFlowTrace((s) => s.toggle);
  const togglePr = useSemanticPr((s) => s.toggle);
  const openPr = useSemanticPr((s) => s.open);
  const togglePrd = usePrDisaster((s) => s.toggle);
  const openPrd = usePrDisaster((s) => s.open);
  const toggleOwnership = useOwnershipMap((s) => s.toggle);
  const openChangeCard = useChangeCard((s) => s.open);
  const showImpact = useChangeImpact((s) => s.show);

  // expose active file's fix proposal to dispatcher (used by ⌘F / context menu)
  useEffect(() => {
    setSuggestedProposalResolver(() => fix.proposal);
    registerCommand("fix", () => { openChangeCard(fix.proposal); });
    return () => { unregisterCommand("fix"); };
  }, [fix, openChangeCard]);

  // register command handlers into dispatcher registry
  useEffect(() => {
    registerCommand("simulate", () => { openSim(); });
    registerCommand("history", () => { toggleTime(); });
    registerCommand("dataflow", () => { toggleTrace(MOCK_TRACE); });
    registerCommand("ask", () => { openCmdK(); });
    registerCommand("pr", () => { openPr(); });
    registerCommand("preflight", () => { openPrd(); });
    registerCommand("ownership", () => { toggleOwnership(); });
    registerCommand("impact", () => {
      if (inspCtxRef.current.mode === "impact") { setFileContextRef.current(activeRef.current); }
      else { showImpact(SAMPLE_IMPACT); setImpactContext(); }
    });
    return () => {
      for (const id of ["simulate", "history", "dataflow", "ask", "pr", "preflight", "ownership", "impact"]) {
        unregisterCommand(id);
      }
    };
  }, [openSim, toggleTime, toggleTrace, openCmdK, openPr, openPrd, toggleOwnership, showImpact, setImpactContext]);

  return {
    toggleAgent,
    toggleCmdK,
    openCmdK,
    toggleSim,
    openSim,
    toggleTime,
    toggleTrace,
    togglePr,
    openPr,
    togglePrd,
    openPrd,
    toggleOwnership,
    openChangeCard,
    showImpact,
  };
}
