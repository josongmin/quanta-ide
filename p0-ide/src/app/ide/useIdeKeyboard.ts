import { useEffect, useRef } from "react";
import { dispatchCommand } from "@/features/ide-command-palette";
import { MOCK_TRACE, type TraceLine } from "@/features/ide-flow-trace";
import { SAMPLE_IMPACT, type ChangeImpactData } from "@/features/ide-change-impact";
import type { InspectorContext } from "@/features/ide-inspector-context";

export interface UseIdeKeyboardDeps {
  toggleCmdK: () => void;
  toggleSim: () => void;
  toggleTime: () => void;
  toggleTrace: (lines: TraceLine[]) => void;
  togglePr: () => void;
  togglePrd: () => void;
  toggleOwnership: () => void;
  toggleAgent: () => void;
  showImpact: (data: ChangeImpactData) => void;
  setImpactContext: () => void;
  inspCtx: InspectorContext;
  active: string;
  setFileContext: (name: string) => void;
}

export function useIdeKeyboard(deps: UseIdeKeyboardDeps): void {
  const {
    toggleCmdK, toggleSim, toggleTime, toggleTrace,
    togglePr, togglePrd, toggleOwnership, toggleAgent,
    showImpact, setImpactContext, inspCtx, active, setFileContext,
  } = deps;

  // Refs for frequently-changing values — prevent listener re-registration on every navigation
  const inspCtxRef = useRef(inspCtx);
  const activeRef = useRef(active);
  const setFileContextRef = useRef(setFileContext);

  inspCtxRef.current = inspCtx;
  activeRef.current = active;
  setFileContextRef.current = setFileContext;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      const key = e.key.toLowerCase();
      if (key === "k") { e.preventDefault(); toggleCmdK(); return; }
      if (key === "s" && e.shiftKey) { e.preventDefault(); toggleSim(); return; }
      if (key === "t" || key === "h") { e.preventDefault(); toggleTime(); return; }
      if (key === ".") { e.preventDefault(); toggleTrace(MOCK_TRACE); return; }
      if (key === "g") { e.preventDefault(); dispatchCommand("callgraph"); return; }
      if (key === "b") { e.preventDefault(); dispatchCommand("blast"); return; }
      if (key === "f") { e.preventDefault(); dispatchCommand("fix"); return; }
      if (key === "e") { e.preventDefault(); dispatchCommand("extract"); return; }
      if (key === "p" && e.shiftKey) { e.preventDefault(); togglePr(); return; }
      if (key === "d" && e.shiftKey) { e.preventDefault(); togglePrd(); return; }
      if (key === "o" && e.shiftKey) { e.preventDefault(); toggleOwnership(); return; }
      if (key === "a" && e.shiftKey) { e.preventDefault(); toggleAgent(); }
      if (key === "i" && e.shiftKey) {
        e.preventDefault();
        if (inspCtxRef.current.mode === "impact") { setFileContextRef.current(activeRef.current); }
        else { showImpact(SAMPLE_IMPACT); setImpactContext(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [toggleCmdK, toggleSim, toggleTime, toggleTrace, togglePr, togglePrd, toggleOwnership, toggleAgent, showImpact, setImpactContext]);
}
