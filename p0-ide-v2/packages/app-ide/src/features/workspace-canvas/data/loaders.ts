import { SOURCES } from "@quanta/app-ide/entities/file";
import type { GroundFileData } from "../store/workspace-canvas-store";

export async function loadGroundData(fileId: string): Promise<GroundFileData> {
  // Mock data is synchronous — just lookup from entity mocks
  const source = SOURCES[fileId] ?? "";
  return { source };
}
