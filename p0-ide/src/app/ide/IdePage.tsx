import { useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useGnbStore, selectActiveTab } from "@/entities/gnb";

const ReviewPage = lazy(() => import("@/features/ide-gnb-pages/ui/ReviewPage").then(m => ({ default: m.ReviewPage })));
const AgentPage = lazy(() => import("@/features/ide-gnb-pages/ui/AgentPage").then(m => ({ default: m.AgentPage })));
const QualityPage = lazy(() => import("@/features/ide-gnb-pages/ui/QualityPage").then(m => ({ default: m.QualityPage })));
const SecurityPage = lazy(() => import("@/features/ide-gnb-pages/ui/SecurityPage").then(m => ({ default: m.SecurityPage })));
const PolicyPage = lazy(() => import("@/features/ide-gnb-pages/ui/PolicyPage").then(m => ({ default: m.PolicyPage })));
import "@/features/ide-gnb-pages/styles/gnb-pages.css";
import { IdeTopBar } from "@/widgets/ide-topbar";
import { IdeFiles } from "@/widgets/ide-files";
import type { CodeLine } from "@/widgets/ide-editor";
import { EditableEditor } from "@/features/ide-editable-editor";
import { IdeInspector } from "@/widgets/ide-inspector";
import { IdeStatusBar } from "@/widgets/ide-statusbar";
import { IdeBottomPanel } from "@/widgets/ide-bottom-panel";
import { type CallNode } from "@/features/ide-call-graph";
import { type FlowStep } from "@/features/ide-data-flow";
import { CommandPalette } from "@/features/ide-command-palette";
import { SymbolTooltip } from "@/features/ide-editor-hover";
import { SimulatePanel } from "@/features/ide-simulate-change";
import { TimeTravelStrip } from "@/features/ide-time-travel";
import { WelcomeTour } from "@/features/ide-welcome-tour";
import { ContextMenu, useContextMenu } from "@/features/ide-context-menu";
import { useLiveTyping } from "@/features/ide-live-typing";
import { FlowTraceOverlay } from "@/features/ide-flow-trace";
import { Toast, useToast } from "@/features/ide-toast";
import { FileTooltip, useFileTooltip } from "@/features/ide-file-tooltip";
import { ChangeCard } from "@/features/ide-change-card";
import { SemanticPrPanel } from "@/features/ide-semantic-pr";
import { PrDisasterPanel } from "@/features/ide-pr-disaster";
import { IncidentAlert, useIncidentAlert, SAMPLE_MATCH } from "@/features/ide-incident-alert";
import { OwnershipOverlay } from "@/features/ide-ownership-map";
import { GuardPill } from "@/features/ide-guard-pill";
import { AgentWindow } from "@/features/ide-agent-window";
import { ImpactBanner, SAMPLE_IMPACT } from "@/features/ide-change-impact";
import { useIdeTheme } from "@/features/ide-theme";
import { useRepoIcon, useRepoStore } from "@/entities/repo";
import { InspectorContent } from "./InspectorContent";
import { FILE_INSPECTOR } from "./mock-file-inspector";
import type { FileName } from "./model/useActiveFile";
import { MOCK_FILES, MOCK_CALL_GRAPH, MOCK_DATA_FLOW } from "./mock";
import { CHARGE_LINES, CHARGE_CALL_GRAPH, CHARGE_DATA_FLOW } from "./mock-charge";
import { LEDGER_LINES, LEDGER_CALL_GRAPH, LEDGER_DATA_FLOW } from "./mock-ledger";
import { REFUND_LINES } from "./mock-refund-lines";
import { FILE_FIXES } from "./mock-fixes";
import { FILE_PR } from "./mock-pr";
import { FILE_SOURCE, FILE_LINE_META, SYMBOL_IMPACTS } from "./mock-source";
import { useIdeFileNavigation } from "./useIdeFileNavigation";
import { useIdeInspector } from "./useIdeInspector";
import { useIdeCommands } from "./useIdeCommands";
import { useIdeKeyboard } from "./useIdeKeyboard";

/* ── Per-file data registry ── */
interface FileData {
  lines: CodeLine[];
  callGraph: CallNode[];
  dataFlow: FlowStep[];
  funcName: string;
  loc: string;
  riskScore: number;
  cpx: string;
  callers: string;
  tests: string;
  blast: string;
}

const FILE_DATA: Record<FileName, FileData> = {
  "orchestrator.py": {
    lines: REFUND_LINES,
    callGraph: MOCK_CALL_GRAPH,
    dataFlow: MOCK_DATA_FLOW,
    funcName: "execute",
    loc: "orchestrator.py:315",
    riskScore: 78,
    cpx: "9.1",
    callers: "12",
    tests: "0/12",
    blast: "38",
  },
  "routing_policy.py": {
    lines: CHARGE_LINES,
    callGraph: CHARGE_CALL_GRAPH,
    dataFlow: CHARGE_DATA_FLOW,
    funcName: "_route_request",
    loc: "routing_policy.py:88",
    riskScore: 44,
    cpx: "5.1",
    callers: "9",
    tests: "1/9",
    blast: "14",
  },
  "security.py": {
    lines: CHARGE_LINES,
    callGraph: CHARGE_CALL_GRAPH,
    dataFlow: CHARGE_DATA_FLOW,
    funcName: "_analyze_taint_path_control_flow",
    loc: "security.py:477",
    riskScore: 52,
    cpx: "6.3",
    callers: "7",
    tests: "2/7",
    blast: "21",
  },
  "audit_store.py": {
    lines: LEDGER_LINES,
    callGraph: LEDGER_CALL_GRAPH,
    dataFlow: LEDGER_DATA_FLOW,
    funcName: "store_request",
    loc: "audit_store.py:4",
    riskScore: 23,
    cpx: "2.4",
    callers: "5",
    tests: "5/5",
    blast: "8",
  },
};

/* ── Page ── */
export function IdePage() {
  const { t } = useTranslation();
  const activeTab = useGnbStore(selectActiveTab);
  const openCtx = useContextMenu((s) => s.open);
  const blastDelta = useLiveTyping((s) => s.blastDelta);
  const isEditing = useLiveTyping((s) => s.isEditing);
  const showToast = useToast((s) => s.show);
  const showFileTip = useFileTooltip((s) => s.show);
  const hideFileTip = useFileTooltip((s) => s.hide);
  const showIncident = useIncidentAlert((s) => s.show);
  const theme = useIdeTheme((s) => s.theme);
  const { icon: repoIcon } = useRepoIcon();
  const repoName = useRepoStore((s) => s.current);

  // ── extracted hooks ──
  const { inspCtx, setFileContext, setRepoContext, setImpactContext } = useIdeInspector();
  const { active, tabs, setActive, closeTab, navigateToFile, FILE_NAMES } = useIdeFileNavigation(setFileContext);

  const fd = FILE_DATA[active];
  const fix = FILE_FIXES[active];
  const prDraft = FILE_PR[active];
  const activeSource = FILE_SOURCE[active] ?? "";

  const {
    openCmdK, toggleTime, openSim, openChangeCard, showImpact,
    toggleAgent, toggleCmdK, toggleSim, toggleTrace, togglePr,
    togglePrd, openPrd, toggleOwnership,
  } = useIdeCommands({ inspCtx, active, setFileContext, setImpactContext, fix });

  useIdeKeyboard({
    toggleCmdK, toggleSim, toggleTime, toggleTrace,
    togglePr, togglePrd, toggleOwnership, toggleAgent,
    showImpact, setImpactContext, inspCtx, active, setFileContext,
  });

  // on code edit → detect impacted symbol → trigger impact panel
  const handleCodeChange = useCallback((code: string, changedLine: number) => {
    const lines = code.split("\n");
    const editedLine = lines[changedLine - 1] ?? "";

    for (const mapping of SYMBOL_IMPACTS) {
      if (mapping.linePattern.test(editedLine)) {
        showImpact({
          originLine: changedLine,
          originFn: mapping.originFn,
          riskScore: mapping.riskScore,
          files: mapping.files,
          functions: mapping.functions,
          apis: mapping.apis,
          tests: mapping.tests,
          confidence: mapping.confidence,
          summary: mapping.summary,
          propagation: SAMPLE_IMPACT.propagation,
          topFiles: SAMPLE_IMPACT.topFiles,
        });
        setImpactContext();
        return;
      }
    }
  }, [showImpact, setImpactContext]);

  // live typing → trigger Incident DNA match when behavior change detected
  useEffect(() => {
    if (isEditing && blastDelta > 0) {
      const timer = setTimeout(() => { showIncident(SAMPLE_MATCH); }, 600);
      return () => { clearTimeout(timer); };
    }
  }, [isEditing, blastDelta, showIncident]);

  const handleEditorContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openCtx(e.clientX, e.clientY);
  };

  const handleEditorDeselect = useCallback(() => {
    if (inspCtx.mode === "symbol" || inspCtx.mode === "repo") setFileContext(active);
  }, [inspCtx.mode, setFileContext, active]);

  const editorTabs = useMemo(() => tabs.map((tab) => ({ name: tab, active: tab === active })), [tabs, active]);
  const fileNodes = useMemo(() => MOCK_FILES.map((n) => ({ ...n, active: n.name === active })), [active]);

  return (
    <div className="ide" data-theme={theme}>
      <IdeTopBar
        onAsk={openCmdK}
        onTimeTravel={toggleTime}
      />
      {activeTab === "ide" && <TimeTravelStrip />}
      {activeTab === "ide" && <IdeFiles
        nodes={fileNodes}
        repoName={repoName}
        repoIcon={repoIcon}
        onNodeSelect={(name, type) => {
          if (type === "file") {
            const match = FILE_NAMES.find((f) => f === name);
            if (match) setFileContext(match);
          } else {
            setRepoContext(repoName);
          }
        }}
        onFileClick={navigateToFile}
        onRepoClick={() => { setRepoContext(repoName); }}
        onHover={showFileTip}
        onHoverEnd={hideFileTip}
      />}

      {/* ── GNB Tab Pages (full-bleed, replaces sidebar+editor+inspector+bottom) ── */}
      <Suspense fallback={null}>
        {activeTab === "review" && <ReviewPage />}
        {activeTab === "agent" && <AgentPage />}
        {activeTab === "quality" && <QualityPage />}
        {activeTab === "security" && <SecurityPage />}
        {activeTab === "policy" && <PolicyPage />}
      </Suspense>

      {/* ── Code Tab (default) ── */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- right-click + click to deselect symbol */}
      {activeTab === "ide" && <div style={{ display: "contents" }} onContextMenu={handleEditorContextMenu} onClick={handleEditorDeselect}>
        <EditableEditor
          tabs={editorTabs}
          source={activeSource}
          lineMeta={FILE_LINE_META[active] ?? {}}
          onTabClick={(name) => { setActive(name as FileName); }}
          onTabClose={(name) => { closeTab(name as FileName); }}
          onChange={handleCodeChange}
          flowTraceBanner={<FlowTraceOverlay />}
          impactBanner={<ImpactBanner />}
        />
      </div>}
      {activeTab === "ide" && <IdeInspector
        tierKey={inspCtx.mode === "impact" ? "impact" : inspCtx.mode === "symbol" ? "symbol" : inspCtx.mode === "repo" ? "repo" : "file"}
        title={inspCtx.mode === "impact" ? t("ide.changeImpact.title") : inspCtx.mode === "symbol" ? inspCtx.name : inspCtx.mode === "repo" ? inspCtx.repoName : "Inspector"}
        subtitle={inspCtx.mode === "impact" ? t("ide.changeImpact.pgLabel") : inspCtx.mode === "symbol" ? active : undefined}
      >
        <InspectorContent
          inspCtx={inspCtx}
          active={active}
          funcName={fd.funcName}
          callGraph={fd.callGraph}
          dataFlow={fd.dataFlow}
          fileInspectorData={FILE_INSPECTOR[inspCtx.mode === "file" ? inspCtx.fileName : active] ?? FILE_INSPECTOR[active]}
          fix={fix}
          navigateToFile={navigateToFile}
          openSim={openSim}
          openChangeCard={openChangeCard}
          showToast={(msg: string) => { showToast(msg); }}
        />
      </IdeInspector>}
      {activeTab === "ide" && <IdeBottomPanel />}
      {activeTab === "ide" && <IdeStatusBar
        issues={isEditing && blastDelta > 0 ? 3 : 2}
        buildState="passed"
        branch="main"
      />}
      <CommandPalette />
      <SymbolTooltip />
      <SimulatePanel />
      <ContextMenu />
      <WelcomeTour />
      <FileTooltip />
      <ChangeCard />
      <SemanticPrPanel draft={prDraft} onPreflight={openPrd} />
      <PrDisasterPanel />
      <IncidentAlert />
      <OwnershipOverlay />
      <GuardPill />
      <AgentWindow />
      <Toast />
    </div>
  );
}
