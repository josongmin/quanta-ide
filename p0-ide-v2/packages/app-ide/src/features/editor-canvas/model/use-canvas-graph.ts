import { useMemo } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import type { CanvasGraph } from "@quanta/app-ide/entities/canvas";
import { ORCHESTRATOR_SOURCE } from "@quanta/app-ide/entities/file";
import { buildCanvasGraph } from "./build-canvas-graph";

export function useCanvasGraph(file: FileFacts): CanvasGraph {
  return useMemo(() => buildCanvasGraph(file, ORCHESTRATOR_SOURCE), [file]);
}
