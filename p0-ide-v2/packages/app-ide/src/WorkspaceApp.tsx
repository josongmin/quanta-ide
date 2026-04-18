import type { TabAppProps } from "@quanta/shell-contract";
import { MultiFileCanvas, SAMPLE_GRAPH } from "@quanta/app-ide/features/workspace-canvas";

export function WorkspaceApp(_props: TabAppProps) {
  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <MultiFileCanvas graph={SAMPLE_GRAPH} />
    </div>
  );
}
