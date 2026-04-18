import { SAMPLE_SOURCES } from "./sample-graph";
import type { GroundFileData } from "../store/workspace-canvas-store";

export async function loadGroundData(fileId: string): Promise<GroundFileData> {
  const source = SAMPLE_SOURCES[fileId] ?? "";
  return { source };
}
