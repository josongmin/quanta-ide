import { useEffect } from "react";
import { workspaceCanvasStore, useWorkspaceCanvas } from "../store/workspace-canvas-store";
import type { GroundFileData } from "../store/workspace-canvas-store";
import { loadGroundData } from "../data/loaders";

export function useGroundData(fileId: string) {
  const data    = useWorkspaceCanvas(s => s.groundData[fileId]);
  const loading = useWorkspaceCanvas(s => s.groundLoading[fileId] ?? false);

  useEffect(() => {
    if (data || loading) return;
    void fetchGroundData(fileId);
  }, [fileId, data, loading]);

  return { data: data ?? null, loading };
}

async function fetchGroundData(fileId: string): Promise<void> {
  workspaceCanvasStore.setGroundLoading(fileId, true);
  try {
    const result: GroundFileData = await loadGroundData(fileId);
    workspaceCanvasStore.setGroundData(fileId, result);
  } finally {
    workspaceCanvasStore.setGroundLoading(fileId, false);
  }
}
