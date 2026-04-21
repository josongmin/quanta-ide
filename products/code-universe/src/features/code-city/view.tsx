// Code City — 3D repository metaphor (buildings = files, wires = deps).

import { useRef, useState, type ReactElement } from "react";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import {
  buildCodeCityNodesFromGraph,
  pickMaliciousBuildingId,
} from "./model/graph-to-city-nodes";
import { workspaceGraphContentRevision } from "./model/workspace-graph-scene-revision";
import type { CodeNode } from "./model/types";
import { CodeCityHUD } from "./ui/CodeCityHUD";
import { CodeCityPerfHud } from "./ui/CodeCityPerfHud";
import { CodeCityWorld } from "./ui/CodeCityWorld";

export function CodeCityScene({ graph }: { graph: WorkspaceGraph }): ReactElement | null {
  const [active, setActive] = useState<CodeNode | null>(null);

  const sceneCacheRef = useRef<{
    revision: string;
    nodes: CodeNode[];
    maliciousId: string | null;
  } | null>(null);

  const revision = workspaceGraphContentRevision(graph);
  if (
    sceneCacheRef.current === null ||
    sceneCacheRef.current.revision !== revision
  ) {
    const n = buildCodeCityNodesFromGraph(graph);
    sceneCacheRef.current = {
      revision,
      nodes: n,
      maliciousId: pickMaliciousBuildingId(n),
    };
  }
  const { nodes, maliciousId } = sceneCacheRef.current;

  if (nodes.length === 0) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          color: "#94a3b8",
          fontFamily: "ui-monospace, monospace",
          fontSize: 13,
        }}
      >
        No files in workspace graph.
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#000",
      }}
    >
      <CodeCityWorld nodes={nodes} maliciousId={maliciousId} onNodeFocus={setActive} />
      <CodeCityHUD activeNode={active} maliciousId={maliciousId} />
      <CodeCityPerfHud />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.03,
          backgroundImage:
            "radial-gradient(circle at 50% 50%, #fff 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
    </div>
  );
}
