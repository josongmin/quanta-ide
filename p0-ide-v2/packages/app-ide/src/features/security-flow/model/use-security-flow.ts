import { useCallback, useMemo, useState } from "react";
import type {
  SecurityFlowFinding, SecurityFlowPath, SecurityFlowNode, SecurityFlowSelection,
} from "@quanta/app-ide/entities/security-flow";
import { layoutPath, type FlowLayout } from "./layout";

export function useSecurityFlow(finding: SecurityFlowFinding) {
  const [selection, setSelection] = useState<SecurityFlowSelection>({
    pathId: finding.paths[0]?.id ?? null,
    nodeId: null,
  });

  const activePath: SecurityFlowPath | null = useMemo(
    () => finding.paths.find((p) => p.id === selection.pathId) ?? null,
    [finding.paths, selection.pathId],
  );

  const activeNode: SecurityFlowNode | null = useMemo(
    () => activePath?.nodes.find((n) => n.id === selection.nodeId) ?? null,
    [activePath, selection.nodeId],
  );

  const layout: FlowLayout | null = useMemo(
    () => (activePath ? layoutPath(activePath) : null),
    [activePath],
  );

  const selectPath = useCallback((pathId: string) => {
    setSelection({ pathId, nodeId: null });
  }, []);

  const selectNode = useCallback((nodeId: string | null) => {
    setSelection((prev) => ({
      ...prev,
      nodeId: prev.nodeId === nodeId ? null : nodeId,
    }));
  }, []);

  return { selection, activePath, activeNode, layout, selectPath, selectNode };
}
