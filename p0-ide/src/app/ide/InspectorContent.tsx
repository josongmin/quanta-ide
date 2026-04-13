import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { InspectorSection } from "@/widgets/ide-inspector";
import { IdeCallGraph, type CallNode } from "@/features/ide-call-graph";
import { IdeDataFlow, type FlowStep } from "@/features/ide-data-flow";
import { IdeSuggestedFix } from "@/features/ide-suggested-fix";
import { BlastRadiusViz } from "@/features/ide-blast-radius-viz";
import { TimeTravelCompare } from "@/features/ide-time-travel";
import { ChangeImpactPanel } from "@/features/ide-change-impact";
import { FileInspector, SymbolInspector, RepoInspector } from "@/features/ide-inspector-context";
import { CrossServicePanel } from "@/features/ide-cross-service";
import { RootCausePanel } from "@/features/ide-root-cause";
import { EvidenceReplayPanel } from "@/features/ide-evidence-replay";
import { ComplianceAuditPanel } from "@/features/ide-compliance-audit";
import { IncrementalPanel } from "@/features/ide-incremental-analysis";
import { CoverageGapPanel } from "@/features/ide-coverage-gap";
import { DeadCodePanel } from "@/features/ide-dead-code";
import { ChurnHotspotPanel } from "@/features/ide-churn-hotspot";
import type { InspectorContext } from "@/features/ide-inspector-context/model/useInspectorContext";
import type { ChangeProposal } from "@/features/ide-change-card";
import type { FileInspectorData } from "@/app/ide/mock-file-inspector";
import type { FixContent } from "./mock-fixes";
import type { FileName } from "./model/useActiveFile";

interface InspectorContentProps {
  inspCtx: InspectorContext;
  active: FileName;
  funcName: string;
  callGraph: CallNode[];
  dataFlow: FlowStep[];
  fileInspectorData: FileInspectorData;
  fix: FixContent;
  navigateToFile: (name: string) => void;
  openSim: () => void;
  openChangeCard: (proposal: ChangeProposal) => void;
  showToast: (msg: string) => void;
}

export function InspectorContent({
  inspCtx,
  active,
  funcName,
  callGraph,
  dataFlow,
  fileInspectorData,
  fix,
  navigateToFile,
  openSim,
  openChangeCard,
  showToast,
}: InspectorContentProps): ReactNode {
  const { t } = useTranslation();

  switch (inspCtx.mode) {
    case "impact":
      return (
        <ChangeImpactPanel>
          <BlastRadiusViz centerLabel={funcName} fileName={active} onNodeClick={navigateToFile} />
          <CrossServicePanel />
          <RootCausePanel />
          <EvidenceReplayPanel externalEvidence={fix.proposal.evidence} />
          <ComplianceAuditPanel />
          <IncrementalPanel />
        </ChangeImpactPanel>
      );

    case "repo":
      return <RepoInspector />;

    case "file":
      return (
        <FileInspector data={fileInspectorData} onNavigate={navigateToFile}>
          <BlastRadiusViz centerLabel={funcName} fileName={active} onNodeClick={navigateToFile} />
          <CoverageGapPanel fileName={active} />
          <DeadCodePanel fileName={active} />
          <ChurnHotspotPanel fileName={active} />
        </FileInspector>
      );

    case "symbol":
      return (
        <SymbolInspector ctx={inspCtx}>
          <BlastRadiusViz centerLabel={inspCtx.name} fileName={active} onNodeClick={navigateToFile} />
          <InspectorSection label={t("ide.inspector.callGraph")}>
            <IdeCallGraph nodes={callGraph} onNodeClick={navigateToFile} />
          </InspectorSection>
          <InspectorSection label={t("ide.inspector.dataFlow")}>
            <IdeDataFlow steps={dataFlow} />
          </InspectorSection>
          <InspectorSection label={t("ide.inspector.suggestedFix")}>
            <button
              type="button"
              className="ide-btn"
              onClick={openSim}
              style={{ alignSelf: "flex-start", marginBottom: 4 }}
            >
              {t("ide.inspector.simulateChange")}<span className="ide-btn-key">⌘⇧S</span>
            </button>
            <IdeSuggestedFix
              title={t(fix.titleKey)}
              code={fix.code}
              meta={fix.meta.map((m) => ({ k: t(`ide.fixMeta.${m.kKey}`), v: m.v }))}
              onApply={() => { openChangeCard(fix.proposal); }}
              onDismiss={() => { showToast(t("ide.toast.dismissed", { title: t(fix.titleKey) })); }}
            />
          </InspectorSection>
          <TimeTravelCompare />
          <CoverageGapPanel fileName={active} />
          <DeadCodePanel fileName={active} />
          <ChurnHotspotPanel fileName={active} />
          <RootCausePanel />
          <EvidenceReplayPanel externalEvidence={fix.proposal.evidence} />
        </SymbolInspector>
      );

    case "line":
      return null;
  }
}
