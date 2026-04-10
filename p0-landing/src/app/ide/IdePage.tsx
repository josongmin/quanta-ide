import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { IdeTopBar } from "@/widgets/ide-topbar";
import { IdeFiles } from "@/widgets/ide-files";
import { IdeEditor, type CodeLine } from "@/widgets/ide-editor";
import { IdeInspector, InspectorSection } from "@/widgets/ide-inspector";
import { IdeStatusBar } from "@/widgets/ide-statusbar";
import { IdeCallGraph, type CallNode } from "@/features/ide-call-graph";
import { IdeDataFlow, type FlowStep } from "@/features/ide-data-flow";
import { IdeSuggestedFix } from "@/features/ide-suggested-fix";
import { CommandPalette, useCommandPalette, dispatchCommand, setSuggestedProposalResolver, registerCommand, unregisterCommand } from "@/features/ide-command-palette";
import { SymbolTooltip } from "@/features/ide-editor-hover";
import { BlastRadiusViz } from "@/features/ide-blast-radius-viz";
import { SimulatePanel, useSimulateChange } from "@/features/ide-simulate-change";
import { TimeTravelStrip, TimeTravelCompare, useTimeTravel } from "@/features/ide-time-travel";
import { RiskDrawer, useRiskDrawer } from "@/features/ide-risk-drawer";
import { WelcomeTour } from "@/features/ide-welcome-tour";
import { ContextMenu, useContextMenu } from "@/features/ide-context-menu";
import { useLiveTyping } from "@/features/ide-live-typing";
import { FlowTraceOverlay, useFlowTrace, MOCK_TRACE } from "@/features/ide-flow-trace";
import { Toast, useToast } from "@/features/ide-toast";
import { FileTooltip, useFileTooltip } from "@/features/ide-file-tooltip";
import { ChangeCard, useChangeCard } from "@/features/ide-change-card";
import { SemanticPrPanel, useSemanticPr } from "@/features/ide-semantic-pr";
import { PrDisasterPanel, usePrDisaster } from "@/features/ide-pr-disaster";
import { IncidentAlert, useIncidentAlert, SAMPLE_MATCH } from "@/features/ide-incident-alert";
import { OwnershipOverlay, useOwnershipMap } from "@/features/ide-ownership-map";
import { GuardPill, useGuardPill } from "@/features/ide-guard-pill";
import { AgentWindow, useAgentWindow } from "@/features/ide-agent-window";
import { useIdeTheme } from "@/features/ide-theme";
import { useThemeStore } from "@/entities/theme";
import { useInspectorContext, FileInspector, SymbolInspector, RepoInspector } from "@/features/ide-inspector-context";
import { useRepoIcon } from "@/entities/repo";
import { FILE_INSPECTOR } from "./mock-file-inspector";
import { useActiveFile, type FileName } from "./model/useActiveFile";
import { MOCK_FILES, MOCK_CALL_GRAPH, MOCK_DATA_FLOW } from "./mock";
import { CHARGE_LINES, CHARGE_CALL_GRAPH, CHARGE_DATA_FLOW } from "./mock-charge";
import { LEDGER_LINES, LEDGER_CALL_GRAPH, LEDGER_DATA_FLOW } from "./mock-ledger";
import { REFUND_LINES } from "./mock-refund-lines";
import { FILE_FIXES } from "./mock-fixes";
import { FILE_PR } from "./mock-pr";

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
interface IdePageProps {
  onExit: () => void;
}

export function IdePage({ onExit }: IdePageProps) {
  const { t } = useTranslation();
  const { toggle: toggleAgent } = useAgentWindow();
  const { toggle: toggleCmdK, open: openCmdK } = useCommandPalette();
  const { toggle: toggleSim, open: openSim } = useSimulateChange();
  const { toggle: toggleTime } = useTimeTravel();
  const { toggle: toggleRisk } = useRiskDrawer();
  const { open: openCtx } = useContextMenu();
  const { toggle: toggleTrace } = useFlowTrace();
  const { active, tabs, setActive, openTab, closeTab } = useActiveFile();
  const { blastDelta, isEditing } = useLiveTyping();
  const { show: showToast } = useToast();
  const { show: showFileTip, hide: hideFileTip } = useFileTooltip();
  const { open: openChangeCard } = useChangeCard();
  const { toggle: togglePr, open: openPr } = useSemanticPr();
  const { toggle: togglePrd, open: openPrd } = usePrDisaster();
  const { show: _showGuard } = useGuardPill();
  const { show: showIncident } = useIncidentAlert();
  const { toggle: toggleOwnership } = useOwnershipMap();
  const { theme } = useIdeTheme();
  const { icon: repoIcon } = useRepoIcon();
  const { aurora } = useThemeStore();
  const { context: inspCtx, setFileContext, setRepoContext } = useInspectorContext();
  useEffect(() => {
    document.documentElement.setAttribute("data-aurora", aurora);
  }, [aurora]);

  // sync inspector to active file on tab switch
  useEffect(() => {
    if (inspCtx.mode === "file" || (inspCtx.mode === "symbol" && inspCtx.fileName !== active)) {
      setFileContext(active);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const ALL_FILES: FileName[] = ["orchestrator.py", "routing_policy.py", "security.py", "audit_store.py"];

  const navigateToFile = (name: string) => {
    const match = ALL_FILES.find((f) => f === name || name.endsWith(f));
    if (match) {
      openTab(match);
      setFileContext(match);
    }
  };

  // file data for active tab
  const fd = FILE_DATA[active];
  const fix = FILE_FIXES[active];
  const prDraft = FILE_PR[active];

  // expose active file's fix proposal to dispatcher (used by ⌘F / context menu)
  useEffect(() => {
    setSuggestedProposalResolver(() => fix.proposal);
    registerCommand("fix", () => { openChangeCard(fix.proposal); });
    return () => { unregisterCommand("fix"); };
  }, [fix, openChangeCard]);


  // live typing → trigger Incident DNA match when behavior change detected
  useEffect(() => {
    if (isEditing && blastDelta > 0) {
      const t = setTimeout(() => { showIncident(SAMPLE_MATCH); }, 600);
      return () => { clearTimeout(t); };
    }
  }, [isEditing, blastDelta, showIncident]);

  // register command handlers into dispatcher registry
  useEffect(() => {
    registerCommand("simulate", () => { openSim(); });
    registerCommand("history", () => { toggleTime(); });
    registerCommand("dataflow", () => { toggleTrace(MOCK_TRACE); });
    registerCommand("ask", () => { openCmdK(); });
    registerCommand("dead", () => { toggleRisk(); });
    registerCommand("pr", () => { openPr(); });
    registerCommand("preflight", () => { openPrd(); });
    registerCommand("ownership", () => { toggleOwnership(); });
    return () => {
      for (const id of ["simulate", "history", "dataflow", "ask", "dead", "pr", "preflight", "ownership"]) {
        unregisterCommand(id);
      }
    };
  }, [openSim, toggleTime, toggleTrace, openCmdK, toggleRisk, openPr, openPrd, toggleOwnership]);

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      const key = e.key.toLowerCase();
      if (key === "k") { e.preventDefault(); toggleCmdK(); return; }
      if (key === "s" && e.shiftKey) { e.preventDefault(); toggleSim(); return; }
      if (key === "t" || key === "h") { e.preventDefault(); toggleTime(); return; }
      if (key === "r" && e.shiftKey) { e.preventDefault(); toggleRisk(); return; }
      if (key === ".") { e.preventDefault(); toggleTrace(MOCK_TRACE); return; }
      if (key === "g") { e.preventDefault(); dispatchCommand("callgraph"); return; }
      if (key === "b") { e.preventDefault(); dispatchCommand("blast"); return; }
      if (key === "f") { e.preventDefault(); dispatchCommand("fix"); return; }
      if (key === "e") { e.preventDefault(); dispatchCommand("extract"); return; }
      if (key === "p" && e.shiftKey) { e.preventDefault(); togglePr(); return; }
      if (key === "d" && e.shiftKey) { e.preventDefault(); togglePrd(); return; }
      if (key === "o" && e.shiftKey) { e.preventDefault(); toggleOwnership(); return; }
      if (key === "a" && e.shiftKey) { e.preventDefault(); toggleAgent(); }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [toggleCmdK, toggleSim, toggleTime, toggleRisk, toggleTrace, togglePr, togglePrd, toggleOwnership, toggleAgent]);

  const handleEditorContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openCtx(e.clientX, e.clientY);
  };

  const editorTabs = tabs.map((t) => ({ name: t, active: t === active }));

  return (
    <div className="ide" data-theme={theme}>
      <IdeTopBar
        path={["codegraph-agent", "codegraph_agent", active === "orchestrator.py" ? "orchestrator" : active === "security.py" ? "tools/plan_orchestration/tools" : "infrastructure/audit", active]}
        onExit={onExit}
        onAsk={openCmdK}
        onTimeTravel={toggleTime}
      />
      <TimeTravelStrip />
      <IdeFiles
        nodes={MOCK_FILES.map((n) => ({ ...n, active: n.name === active }))}
        repoName="payments-api"
        repoIcon={repoIcon}
        onNodeSelect={(name, type) => {
          if (type === "file") {
            const match = ALL_FILES.find((f) => f === name);
            if (match) setFileContext(match);
          } else {
            setRepoContext("payments-api");
          }
        }}
        onFileClick={navigateToFile}
        onRepoClick={() => { setRepoContext("payments-api"); }}
        onHover={showFileTip}
        onHoverEnd={hideFileTip}
      />
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- right-click + click to deselect symbol */}
      <div style={{ display: "contents" }} onContextMenu={handleEditorContextMenu} onClick={() => {
        if (inspCtx.mode === "symbol" || inspCtx.mode === "repo") setFileContext(active);
      }}>
        <IdeEditor
          tabs={editorTabs}
          lines={fd.lines}
          onTabClick={(name) => { setActive(name as FileName); }}
          onTabClose={(name) => { closeTab(name as FileName); }}
          flowTraceBanner={<FlowTraceOverlay />}
        />
      </div>
      <IdeInspector
        tierKey={inspCtx.mode === "symbol" ? "symbol" : inspCtx.mode === "repo" ? "repo" : "file"}
        title={inspCtx.mode === "symbol" ? inspCtx.name : inspCtx.mode === "repo" ? inspCtx.repoName : active}
        subtitle={inspCtx.mode === "symbol" ? active : undefined}
      >
        {inspCtx.mode === "repo" ? (
          /* ── Tier 0: Repo ── */
          <RepoInspector />
        ) : inspCtx.mode === "file" ? (
          /* ── Tier 1: File ── */
          <FileInspector data={FILE_INSPECTOR[inspCtx.fileName] ?? FILE_INSPECTOR[active]} onNavigate={navigateToFile}>
            <InspectorSection label={t("ide.inspector.blastRadius")} defaultOpen={false}>
              <BlastRadiusViz centerLabel={fd.funcName} onNodeClick={navigateToFile} />
            </InspectorSection>
          </FileInspector>
        ) : inspCtx.mode === "symbol" ? (
          /* ── Tier 2: Symbol ── */
          <SymbolInspector ctx={inspCtx}>
            <InspectorSection label={t("ide.inspector.blastRadius")}>
              <BlastRadiusViz centerLabel={inspCtx.name} onNodeClick={navigateToFile} />
            </InspectorSection>
            <InspectorSection label={t("ide.inspector.callGraph")}>
              <IdeCallGraph nodes={fd.callGraph} onNodeClick={navigateToFile} />
            </InspectorSection>
            <InspectorSection label={t("ide.inspector.dataFlow")}>
              <IdeDataFlow steps={fd.dataFlow} />
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
          </SymbolInspector>
        ) : null}
      </IdeInspector>
      <IdeStatusBar
        issues={isEditing && blastDelta > 0 ? 3 : 2}
        buildState="passed"
        branch="main"
      />
      <CommandPalette />
      <SymbolTooltip />
      <SimulatePanel />
      <RiskDrawer />
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
