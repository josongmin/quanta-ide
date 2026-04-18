import { useEffect } from "react";
import { workspaceCanvasStore, useWorkspaceCanvas } from "../store/workspace-canvas-store";
import type { GroundFileData } from "../store/workspace-canvas-store";

export function useGroundData(fileId: string) {
  const data    = useWorkspaceCanvas(s => s.groundData[fileId]);
  const loading = useWorkspaceCanvas(s => s.groundLoading[fileId] ?? false);

  useEffect(() => {
    if (data || loading) return;
    void loadGroundData(fileId);
  }, [fileId, data, loading]);

  return { data: data ?? null, loading };
}

async function loadGroundData(fileId: string): Promise<void> {
  workspaceCanvasStore.setGroundLoading(fileId, true);
  try {
    // TODO: wire to real API — for now mock delay
    await new Promise<void>(r => setTimeout(r, 100));
    const result: GroundFileData = { source: "" };
    workspaceCanvasStore.setGroundData(fileId, result);
  } finally {
    workspaceCanvasStore.setGroundLoading(fileId, false);
  }
}
