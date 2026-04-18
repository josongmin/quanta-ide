import { useSceneStore } from "../store/scene-store";
import { useMeasureMode } from "../hooks/use-measure-mode";
import { InspectorPanel } from "./InspectorPanel";
import { HoverSummaryPopover } from "./HoverSummaryPopover";
import { ExportButton } from "./ExportButton";
import { MeasureOverlay } from "./MeasureOverlay";

// Aggregator for Batch 2 (Dev Mode) UI. Each child renders null when its
// feature flag is off, so adding the layer once to MultiFileCanvas costs
// nothing when all of devmode.* is disabled.
//
// Returns the measure-mode state so MultiFileCanvas can intercept selection
// events (holding M + click routes into the measure state machine instead
// of the normal selectFile path).

export interface DevModeLayerApi {
  tryCaptureSelection: (fileId: string | null) => boolean;
}

interface Props {
  onReady?: (api: DevModeLayerApi) => void;
}

export function DevModeLayer({ onReady }: Props) {
  const graph = useSceneStore(s => s.graph);
  const measure = useMeasureMode(graph);

  // Publish the capture handler to the parent. Parent stores it on a ref
  // so it can route clicks without re-rendering when measure state changes.
  if (onReady) onReady({ tryCaptureSelection: measure.tryCaptureSelection });

  return (
    <>
      <InspectorPanel />
      <HoverSummaryPopover />
      <ExportButton />
      <MeasureOverlay
        phase={measure.phase}
        measureA={measure.measureA}
        measureB={measure.measureB}
        result={measure.result}
        onReset={measure.reset}
      />
    </>
  );
}
