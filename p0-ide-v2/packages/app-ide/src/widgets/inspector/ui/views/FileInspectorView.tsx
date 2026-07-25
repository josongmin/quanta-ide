import "./file-inspector.css";
import "./new-inspectors.css";
import { useEffect, useState } from "react";
import { FILES } from "@quanta/app-ide/entities/file";
import { useFocusStore } from "@quanta/app-ide/stores/focus-store";
import { FlowPane } from "@quanta/app-ide/features/inspector-flow";
import { BlastPane } from "@quanta/app-ide/features/inspector-blast";
import { IncidentsPane } from "@quanta/app-ide/features/inspector-incidents";
import { BehaviorPane } from "@quanta/app-ide/features/inspector-behavior";
import { OwnershipPane } from "@quanta/app-ide/features/inspector-ownership";
import { RequestPane } from "@quanta/app-ide/features/inspector-request";
import { AuthzPane } from "@quanta/app-ide/features/inspector-authz";
import { ConfigPane } from "@quanta/app-ide/features/inspector-config";
import { CvePane } from "@quanta/app-ide/features/inspector-cve";
import { ObservabilityPane } from "@quanta/app-ide/features/inspector-observability";
import { TransactionPane } from "@quanta/app-ide/features/inspector-transaction";
import { IdempotencyPane } from "@quanta/app-ide/features/inspector-idempotency";
import { ContextPane } from "@quanta/app-ide/features/inspector-context";
import { TestImpactPane } from "@quanta/app-ide/features/inspector-test-impact";
import { FlagsPane } from "@quanta/app-ide/features/inspector-flags";
import { ConcurrencyPane } from "@quanta/app-ide/features/inspector-concurrency";
import { ReplayPane } from "@quanta/app-ide/features/inspector-replay";
import { RefactorSimPane } from "@quanta/app-ide/features/inspector-refactor-sim";
import { KnowledgePane } from "@quanta/app-ide/features/inspector-knowledge";
import { TestIntelPane } from "@quanta/app-ide/features/inspector-test-intel";
import { ServiceMeshPane } from "@quanta/app-ide/features/inspector-service-mesh";
import { ErrorFlowPane } from "@quanta/app-ide/features/inspector-error-flow";
import { RolloutPane } from "@quanta/app-ide/features/inspector-rollout";
import { IntentGapPane } from "@quanta/app-ide/features/inspector-intent-gap";
import { CollabPane } from "@quanta/app-ide/features/inspector-collab";
import { EvalBenchPane } from "@quanta/app-ide/features/inspector-eval-bench";
import { TokenRadarPane } from "@quanta/app-ide/features/inspector-token-radar";
import { getFlagMap } from "@quanta/app-ide/entities/flag";
import { getConcurrencyMap } from "@quanta/app-ide/entities/concurrency";
import { getReplay } from "@quanta/app-ide/entities/incident-replay";
import { getRefactorSim } from "@quanta/app-ide/entities/refactor-sim";
import { getKnowledgeGraph } from "@quanta/app-ide/entities/knowledge";
import { getTestIntel } from "@quanta/app-ide/entities/test-intel";
import { getServiceMesh } from "@quanta/app-ide/entities/service-mesh";
import { getErrorFlow } from "@quanta/app-ide/entities/error-flow";
import { getRolloutPlan } from "@quanta/app-ide/entities/rollout";
import { getIntentReport } from "@quanta/app-ide/entities/intent-gap";
import { getCollabReport } from "@quanta/app-ide/entities/collab";
import { getBenchRun } from "@quanta/app-ide/entities/eval-bench";
import { getTokenRadarReport } from "@quanta/app-ide/entities/token-radar";
import { SuggestionOverlay } from "./SuggestionOverlay";
import { InspectorModeTabs } from "./InspectorModeTabs";
import { FileInspectorHero } from "./FileInspectorHero";
import { FileSignalsSection } from "./FileSignalsSection";
import { FileCoverageSection } from "./FileCoverageSection";
import { FileSymbolsSection } from "./FileSymbolsSection";
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
          flags: getFlagMap(name)?.flags.length,
          concurrency: getConcurrencyMap(name)?.races.length,
          replay: getReplay(name)?.events.length,
          "refactor-sim": getRefactorSim(name)?.candidates.length,
          knowledge: getKnowledgeGraph(name)?.nodes.length,
          "test-intel": getTestIntel(name)?.tests.length,
          "service-mesh": getServiceMesh(name)?.nodes.length,
          "error-flow": getErrorFlow(name)?.uncaughtCount,
          rollout: getRolloutPlan(name)?.stages.length,
          "intent-gap": getIntentReport(name)?.gaps.length,
          collab: getCollabReport(name)?.candidates.length,
          "eval-bench": getBenchRun(name)?.regressedTaskIds.length,
          "token-radar":
            getTokenRadarReport(name) === null
              ? undefined
              : (getTokenRadarReport(name)?.run.recommendations.filter(
                  (r) => r.severity === "critical" || r.severity === "warn",
                ).length ?? 0),
        }}
      />

      {mode !== "overview" && file && (
        <div className="insp__pane">
          {mode === "flow" && <FlowPane file={file} />}
          {mode === "blast" && <BlastPane file={file} />}
          {mode === "incidents" && <IncidentsPane file={file} />}
          {mode === "behavior" && <BehaviorPane file={file} />}
          {mode === "ownership" && <OwnershipPane file={file} />}
          {mode === "request" && <RequestPane file={file} />}
          {mode === "authz" && <AuthzPane file={file} />}
          {mode === "config" && <ConfigPane file={file} />}
          {mode === "cve" && <CvePane file={file} />}
          {mode === "observability" && <ObservabilityPane file={file} />}
          {mode === "transaction" && <TransactionPane file={file} />}
          {mode === "idempotency" && <IdempotencyPane file={file} />}
          {mode === "context" && <ContextPane file={file} />}
          {mode === "test-impact" && <TestImpactPane file={file} />}
          {mode === "flags" && <FlagsPane file={file} />}
          {mode === "concurrency" && <ConcurrencyPane file={file} />}
          {mode === "replay" && <ReplayPane file={file} />}
          {mode === "refactor-sim" && <RefactorSimPane file={file} />}
          {mode === "knowledge" && <KnowledgePane file={file} />}
          {mode === "test-intel" && <TestIntelPane file={file} />}
          {mode === "service-mesh" && <ServiceMeshPane file={file} />}
          {mode === "error-flow" && <ErrorFlowPane file={file} />}
          {mode === "rollout" && <RolloutPane file={file} />}
          {mode === "intent-gap" && <IntentGapPane file={file} />}
          {mode === "collab" && <CollabPane file={file} />}
          {mode === "eval-bench" && <EvalBenchPane file={file} />}
          {mode === "token-radar" && <TokenRadarPane file={file} />}
        </div>
      )}

      {mode === "overview" && (
        <div className="insp__overview-wrap">
          <FileInspectorHero name={name} />
          {file && <FileSymbolsSection file={file} />}
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
