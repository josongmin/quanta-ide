import { useEffect, type ReactElement, type ReactNode } from "react";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { buildEntityTree, entityStore } from "../entities/entity";
import { tierStore } from "../entities/tier";
import {
  setWorkspaceGraph,
  useWorkspaceGraph,
} from "../shared/api/graph-source";
import { MOCK_GRAPH } from "../shared/config/mock-graph";
import { CanvasShell } from "../widgets/canvas-shell";

// CodeUniverse
// --------------------------------------------------------------------
// Product composition root. Three ways the graph can arrive:
//   1. Via the `graph` prop (host passes it directly on mount).
//   2. Via `setWorkspaceGraph(g)` from the host at any time — the
//      orchestrator subscribes to `useWorkspaceGraph` and reacts.
//   3. Neither — we fall back to `MOCK_GRAPH` from shared/config so
//      the product is usable bare (Storybook, bare Vite, demo).
//
// Store lifecycle: entity + tier stores reset on unmount so a later
// re-mount (e.g. re-opening the universe tab) starts clean. Global
// graph source is left intact — the host owns it.

export interface CodeUniverseProps {
  /** Tab-bus wiring from the shell registry. Unused in 3B but part
   *  of the TabAppDescriptor contract. */
  tabId?: string;
  /** When false, the host has switched to another tab. Future Pixi
   *  ticker will pause on this. */
  isActive?: boolean;
  /** Optional direct graph injection (bypasses the module singleton). */
  graph?: WorkspaceGraph;
  /** Slot for host-injected providers. */
  children?: ReactNode;
}

export function CodeUniverse(props: CodeUniverseProps): ReactElement {
  // Prop path — set the module-level graph so the rest of the
  // product (and any future pinned inspector panels) see the same
  // source. Passing `undefined` leaves whatever the host already
  // pushed; only an explicit prop overrides.
  useEffect(() => {
    if (props.graph !== undefined) {
      setWorkspaceGraph(props.graph);
    }
  }, [props.graph]);

  const moduleGraph = useWorkspaceGraph();
  // Prop wins if present, else module singleton, else mock.
  const effective = props.graph ?? moduleGraph ?? MOCK_GRAPH;

  // Rebuild the entity tree whenever the effective graph changes.
  useEffect(() => {
    const tree = buildEntityTree(effective);
    entityStore.setTree(tree);
  }, [effective]);

  useEffect(() => {
    return () => {
      tierStore.reset();
      entityStore.reset();
    };
  }, []);

  return <CanvasShell />;
}
