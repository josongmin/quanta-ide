import { useEffect, useState } from "react";
import { FILES } from "@/entities/file";
import { useFocusStore } from "@/shared/model/focus-store";
import { FlowPane } from "@/features/inspector-flow";
import { BlastPane } from "@/features/inspector-blast";
import { IncidentsPane } from "@/features/inspector-incidents";
import { BehaviorPane } from "@/features/inspector-behavior";
import { OwnershipPane } from "@/features/inspector-ownership";
import { SuggestionOverlay } from "./SuggestionOverlay";
import { InspectorModeTabs } from "./InspectorModeTabs";
import { FileInspectorHero } from "./FileInspectorHero";
import { FileSignalsSection } from "./FileSignalsSection";
import { FileCoverageSection } from "./FileCoverageSection";
import { FileDeadCodeSection } from "./FileDeadCodeSection";
import { FileChurnSection } from "./FileChurnSection";
import { FileFixSection } from "./FileFixSection";
import { FileSpecRulesSection } from "./FileSpecRulesSection";
import { FileAiContributionSection } from "./FileAiContributionSection";
import { suggestion } from "./FileInspectorView.mock";

export function FileInspectorView({ name }: { name: string }) {
  const mode = useFocusStore((s) => s.mode);
  const file = FILES[name];
  const [suggestionOpen, setSuggestionOpen] = useState(false);

  useEffect(() => {
    if (mode !== "overview" && suggestionOpen) setSuggestionOpen(false);
  }, [mode, suggestionOpen]);

  return (
    <>
      <InspectorModeTabs
        counts={{
          flow: file?.taintPaths.length,
          blast: file?.blast,
          incidents: file?.incidents.length,
          behavior: file?.behaviorDiff.length,
        }}
      />

      {mode !== "overview" && file && (
        <div className="insp__pane">
          {mode === "flow" && <FlowPane file={file} />}
          {mode === "blast" && <BlastPane file={file} />}
          {mode === "incidents" && <IncidentsPane file={file} />}
          {mode === "behavior" && <BehaviorPane file={file} />}
          {mode === "ownership" && <OwnershipPane file={file} />}
        </div>
      )}

      {mode === "overview" && (
        <div className="insp__overview-wrap">
          <FileInspectorHero name={name} />
          <FileSignalsSection />
          <FileCoverageSection />
          <FileDeadCodeSection />
          <FileChurnSection />
          <FileFixSection onOpenDetails={() => setSuggestionOpen(true)} />
          <FileSpecRulesSection />
          <FileAiContributionSection />

          {suggestionOpen && (
            <SuggestionOverlay data={suggestion} onClose={() => setSuggestionOpen(false)} />
          )}
        </div>
      )}
    </>
  );
}
