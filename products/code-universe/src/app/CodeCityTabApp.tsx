// Standalone shell tab — 3D Code City only (shares workspace graph bridge).

import { useEffect, type ReactElement } from "react";
import { color, font } from "../shared/ui/tokens";
import { ensureA11yStyles } from "../shared/ui/a11y-styles";
import { MOCK_GRAPH } from "../shared/config/mock-graph";
import {
  setWorkspaceGraph,
  useWorkspaceGraph,
} from "../shared/api/graph-source";
import { CodeCityScene } from "../features/code-city/view";

export interface CodeCityTabAppProps {
  tabId?: string;
  isActive?: boolean;
}

export function CodeCityTabApp(_props: CodeCityTabAppProps): ReactElement {
  const moduleGraph = useWorkspaceGraph();
  const effective = moduleGraph ?? MOCK_GRAPH;

  useEffect(() => {
    setWorkspaceGraph(effective);
  }, [effective]);

  useEffect(() => {
    ensureA11yStyles();
  }, []);

  return (
    <div
      data-product="code-universe"
      style={{
        height: "100%",
        width: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: color.bg0,
      }}
    >
      <header
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          alignItems: "flex-start",
          justifyContent: "center",
          padding: `${8}px ${12}px`,
          borderBottom: `1px solid ${color.border}`,
          background: color.bg1,
          fontFamily: font.sans,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: font.weight.semibold,
            color: color.text0,
            lineHeight: 1.25,
          }}
        >
          Code City
        </div>
        <div
          style={{
            fontSize: font.size.sm,
            fontWeight: font.weight.regular,
            color: color.text2,
            lineHeight: 1.3,
          }}
        >
          Dev scan · import graph
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0, position: "relative", background: "#000" }}>
        <CodeCityScene graph={effective} />
      </div>
    </div>
  );
}
