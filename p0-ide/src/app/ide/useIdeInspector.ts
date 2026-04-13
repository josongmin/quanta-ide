import { useEffect } from "react";
import { useInspectorContext } from "@/features/ide-inspector-context";
import { useThemeStore } from "@/entities/theme";
import { useActiveFile } from "./model/useActiveFile";

export function useIdeInspector() {
  const { context: inspCtx, setFileContext, setRepoContext, setSymbolContext, setImpactContext } = useInspectorContext();
  const aurora = useThemeStore((s) => s.aurora);
  const active = useActiveFile((s) => s.active);

  // sync aurora attribute to document root
  useEffect(() => {
    document.documentElement.setAttribute("data-aurora", aurora);
  }, [aurora]);

  // sync inspector to active file on tab switch
  useEffect(() => {
    if (inspCtx.mode === "file" || (inspCtx.mode === "symbol" && inspCtx.fileName !== active)) {
      setFileContext(active);
    }
  }, [active, inspCtx.mode, inspCtx.fileName, setFileContext]);

  return { inspCtx, setFileContext, setRepoContext, setSymbolContext, setImpactContext };
}
