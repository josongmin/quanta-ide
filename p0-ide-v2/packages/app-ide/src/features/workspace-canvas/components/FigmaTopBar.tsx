import { useMemo } from "react";
import type { LodLevel } from "@quanta/canvas-engine";
import { useInteractionStore, interactionStore } from "../store/interaction-store";
import { useSceneStore } from "../store/scene-store";
import {
  FIGMA_MODE_HINT,
  FIGMA_MODE_LABEL,
  figmaModeStore,
  useFigmaMode,
  type FigmaMode,
} from "../store/figma-mode-store";
import { useFeature } from "../store/feature-flags-store";

// Figma-style top bar — breadcrumb + mode switch + compact search.
// -------------------------------------------------------------------
// The breadcrumb exposes the 9-level semantic zoom hierarchy from the
// spec (Universe → Galaxy → Constellation → District → Block → Building
// → Street). Each segment is mapped to the closest existing LOD tier so
// clicking up/down actually changes the viewport's render level without
// a new renderer stack. A selected file is surfaced as the Block step;
// a selected symbol would be the Building step (future P0-3 patch).

// Map semantic design label → existing LOD tier. Kept here (not in
// interaction-store) so the mapping is a display concern, not
// interaction state. `street-trace` is the pseudo level used when
// evidence is open — no physical LOD shift, but the breadcrumb still
// advertises it.
const ZOOM_STEPS: { label: string; lod: LodLevel; hint: string }[] = [
  { label: "Universe",   lod: "universe",    hint: "System map — domains / platforms" },
  { label: "Galaxy",     lod: "galaxy",      hint: "Services & runtime topology" },
  { label: "District",   lod: "city",        hint: "Feature neighborhoods" },
  { label: "Block",      lod: "street",      hint: "File ego graph" },
  { label: "Building",   lod: "ground",      hint: "Symbols inside a file" },
];

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

export function FigmaTopBar() {
  const enabled = useFeature("power.figmaShell");
  const lod = useInteractionStore(s => s.lod);
  const selectedFileId = useInteractionStore(s => s.viewState.selectedFileId);
  const evidenceOpen = useInteractionStore(s => s.inspectedEvidenceId !== null);
  const mode = useFigmaMode(s => s.mode);
  const graphFiles = useSceneStore(s => s.graph?.files);

  const selectedFile = useMemo(() => {
    if (!selectedFileId || !graphFiles) return null;
    return graphFiles.find(f => f.id === selectedFileId) ?? null;
  }, [selectedFileId, graphFiles]);

  // Active step index — highest step whose LOD ≤ current. When a file is
  // selected we also surface the Block step regardless of LOD.
  const activeIdx = useMemo(() => {
    const lodOrder: LodLevel[] = ["universe", "supergalaxy", "galaxy", "city", "street", "ground"];
    const currentRank = lodOrder.indexOf(lod);
    let best = 0;
    for (let i = 0; i < ZOOM_STEPS.length; i++) {
      const step = ZOOM_STEPS[i];
      const stepRank = lodOrder.indexOf(step.lod);
      if (stepRank <= currentRank) best = i;
    }
    return best;
  }, [lod]);

  if (!enabled) return null;

  return (
    <div className="ws-figma-topbar" role="navigation" aria-label="Figma shell top bar">
      <div className="ws-figma-topbar__left">
        <Breadcrumb activeIdx={activeIdx} selectedFile={selectedFile} evidenceOpen={evidenceOpen} />
      </div>
      <div className="ws-figma-topbar__center">
        <ModeSwitch mode={mode} />
      </div>
      <div className="ws-figma-topbar__right">
        <button
          type="button"
          className="ws-figma-topbar__search"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          title="Open command palette (⌘K)"
        >
          <span className="ws-figma-topbar__search-ic" aria-hidden>⌕</span>
          <span className="ws-figma-topbar__search-ph">Search files, symbols…</span>
          <span className="ws-figma-topbar__search-kbd">⌘K</span>
        </button>
      </div>
    </div>
  );
}

function Breadcrumb({
  activeIdx,
  selectedFile,
  evidenceOpen,
}: {
  activeIdx: number;
  selectedFile: { id: string; name?: string } | null;
  evidenceOpen: boolean;
}) {
  const jump = (lod: LodLevel) => {
    // LOD is usually driven by viewport scale, not an explicit setter —
    // but the interaction store exposes a direct setter for debug /
    // forced-LOD use that we repurpose here. Selection is preserved.
    interactionStore.setLod?.(lod);
  };
  return (
    <div className="ws-figma-crumb" role="list">
      {ZOOM_STEPS.map((step, i) => {
        const active = i === activeIdx;
        return (
          <button
            key={step.label}
            type="button"
            className={`ws-figma-crumb__step${active ? " is-active" : ""}`}
            onClick={() => jump(step.lod)}
            title={step.hint}
          >
            {step.label}
          </button>
        );
      })}
      {selectedFile && (
        <button
          type="button"
          className="ws-figma-crumb__step ws-figma-crumb__step--file"
          onClick={() => interactionStore.selectFile(null)}
          title={selectedFile.id}
        >
          {selectedFile.name ?? basename(selectedFile.id)}
        </button>
      )}
      {evidenceOpen && (
        <span
          className="ws-figma-crumb__step ws-figma-crumb__step--trace"
          title="Precise trace open — cmd+click another edge to re-trace"
        >
          Street · trace
        </span>
      )}
    </div>
  );
}

const MODE_ORDER: readonly FigmaMode[] = ["explore", "analyze", "trace", "diff", "investigate"];

function ModeSwitch({ mode }: { mode: FigmaMode }) {
  return (
    <div className="ws-figma-mode" role="tablist" aria-label="Shell mode">
      {MODE_ORDER.map(m => {
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            className={`ws-figma-mode__chip${active ? " is-active" : ""}`}
            onClick={() => figmaModeStore.setMode(m)}
            title={FIGMA_MODE_HINT[m]}
          >
            {FIGMA_MODE_LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}
