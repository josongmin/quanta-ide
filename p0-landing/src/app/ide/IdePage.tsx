import { useEffect, useMemo } from "react";
import { IdeTopBar } from "@/widgets/ide-topbar";
import { IdeFiles } from "@/widgets/ide-files";
import { IdeEditor, type CodeLine } from "@/widgets/ide-editor";
import { IdeInspector, InspectorSection } from "@/widgets/ide-inspector";
import { IdeStatusBar } from "@/widgets/ide-statusbar";
import { LineInfoBar } from "@/widgets/ide-statusbar/ui/LineInfoBar";
import { IdeMetricRow, type Metric } from "@/features/ide-metrics";
import { IdePills, type Pill } from "@/features/ide-pills";
import { IdeCallGraph, type CallNode } from "@/features/ide-call-graph";
import { IdeDataFlow, type FlowStep } from "@/features/ide-data-flow";
import { IdeSuggestedFix } from "@/features/ide-suggested-fix";
import { CommandPalette, useCommandPalette } from "@/features/ide-command-palette";
import { dispatchCommand } from "@/features/ide-command-palette/model/dispatcher";
import { SymbolTooltip } from "@/features/ide-editor-hover";
import { BlastRadiusViz } from "@/features/ide-blast-radius-viz";
import { SimulatePanel, useSimulateChange } from "@/features/ide-simulate-change";
import { TimeTravelStrip, TimeTravelCompare, useTimeTravel } from "@/features/ide-time-travel";
import { RiskDrawer, useRiskDrawer } from "@/features/ide-risk-drawer";
import { WelcomeTour } from "@/features/ide-welcome-tour";
import { ContextMenu, useContextMenu } from "@/features/ide-context-menu";
import { LiveTypingLine, LiveImpactBanner, useLiveTyping } from "@/features/ide-live-typing";
import { FlowTraceOverlay, useFlowTrace, MOCK_TRACE } from "@/features/ide-flow-trace";
import { AnalysisStatusPanel, AnalysisDemoToggle } from "@/features/ide-analysis-status";
import { Toast, useToast } from "@/features/ide-toast";
import { FileTooltip, useFileTooltip } from "@/features/ide-file-tooltip";
import { useIdeTheme } from "@/features/ide-theme";
import { useActiveFile, type FileName } from "./model/useActiveFile";
import { MOCK_FILES, MOCK_METRICS, MOCK_PILLS, MOCK_CALL_GRAPH, MOCK_DATA_FLOW } from "./mock";
import { CHARGE_LINES, CHARGE_METRICS, CHARGE_PILLS, CHARGE_CALL_GRAPH, CHARGE_DATA_FLOW } from "./mock-charge";
import { LEDGER_LINES, LEDGER_METRICS, LEDGER_PILLS, LEDGER_CALL_GRAPH, LEDGER_DATA_FLOW } from "./mock-ledger";
import { REFUND_LINES } from "./mock-refund-lines";

/* ── Per-file data registry ── */
interface FileData {
  lines: CodeLine[];
  metrics: Metric[];
  pills: Pill[];
  callGraph: CallNode[];
  dataFlow: FlowStep[];
  funcName: string;
  loc: string;
}

const FILE_DATA: Record<FileName, FileData> = {
  "refund.ts": {
    lines: REFUND_LINES,
    metrics: MOCK_METRICS,
    pills: MOCK_PILLS,
    callGraph: MOCK_CALL_GRAPH,
    dataFlow: MOCK_DATA_FLOW,
    funcName: "processRefund",
    loc: "refund.ts:5",
  },
  "charge.ts": {
    lines: CHARGE_LINES,
    metrics: CHARGE_METRICS,
    pills: CHARGE_PILLS,
    callGraph: CHARGE_CALL_GRAPH,
    dataFlow: CHARGE_DATA_FLOW,
    funcName: "processCharge",
    loc: "charge.ts:5",
  },
  "ledger.ts": {
    lines: LEDGER_LINES,
    metrics: LEDGER_METRICS,
    pills: LEDGER_PILLS,
    callGraph: LEDGER_CALL_GRAPH,
    dataFlow: LEDGER_DATA_FLOW,
    funcName: "appendLedger",
    loc: "ledger.ts:4",
  },
};

/* ── Page ── */
interface IdePageProps {
  onExit: () => void;
}

export function IdePage({ onExit }: IdePageProps) {
  const { toggle: toggleCmdK, open: openCmdK } = useCommandPalette();
  const { toggle: toggleSim, open: openSim } = useSimulateChange();
  const { toggle: toggleTime } = useTimeTravel();
  const { toggle: toggleRisk } = useRiskDrawer();
  const { open: openCtx } = useContextMenu();
  const { toggle: toggleTrace } = useFlowTrace();
  const { active, tabs, setActive, openTab, closeTab } = useActiveFile();
  const { blastDelta, taintDelta, isEditing } = useLiveTyping();
  const { show: showToast } = useToast();
  const { show: showFileTip, hide: hideFileTip } = useFileTooltip();
  const { theme, toggle: toggleTheme } = useIdeTheme();

  const navigateToFile = (name: string) => {
    const validFiles: FileName[] = ["refund.ts", "charge.ts", "ledger.ts"];
    const match = validFiles.find((f) => name.includes(f.replace(".ts", "")));
    if (match) { openTab(match); }
  };

  // file data for active tab
  const fd = FILE_DATA[active];

  // live typing deltas applied to metrics
  const liveMetrics = useMemo<Metric[]>(() => {
    if (!isEditing || (blastDelta === 0 && taintDelta === 0)) return fd.metrics;
    return fd.metrics.map((m) => {
      if (m.k === "Blast" && blastDelta > 0) {
        return { ...m, v: String(Number(m.v) + blastDelta), delta: ` (was ${m.v})` };
      }
      return m;
    });
  }, [fd.metrics, isEditing, blastDelta, taintDelta]);

  // live typing deltas applied to pills
  const livePills = useMemo<Pill[]>(() => {
    if (!isEditing || blastDelta === 0) return fd.pills;
    return [...fd.pills, { label: "behavior change", risk: 3 as const }];
  }, [fd.pills, isEditing, blastDelta]);

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
      if (key === "e") { e.preventDefault(); dispatchCommand("extract"); }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [toggleCmdK, toggleSim, toggleTime, toggleRisk, toggleTrace]);

  const handleEditorContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openCtx(e.clientX, e.clientY);
  };

  const editorTabs = tabs.map((t) => ({ name: t, active: t === active }));

  return (
    <div className="ide" data-theme={theme}>
      <IdeTopBar
        path={["payments-api", "src", "payments", active]}
        riskScore={isEditing && blastDelta > 0 ? 78 + blastDelta : 78}
        onExit={onExit}
        onAsk={openCmdK}
        onRiskClick={toggleRisk}
        onTimeTravel={toggleTime}
        theme={theme}
        onThemeToggle={toggleTheme}
      />
      <TimeTravelStrip />
      <IdeFiles
        nodes={MOCK_FILES.map((n) => ({ ...n, active: n.name === active }))}
        onFileClick={navigateToFile}
        onHover={showFileTip}
        onHoverEnd={hideFileTip}
      />
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- right-click context menu */}
      <div style={{ display: "contents" }} onContextMenu={handleEditorContextMenu}>
        <IdeEditor
          tabs={editorTabs}
          lines={fd.lines}
          onTabClick={(name) => { setActive(name as FileName); }}
          onTabClose={(name) => { closeTab(name as FileName); }}
          liveTypingLine={active === "refund.ts" ? <LiveTypingLine /> : undefined}
          flowTraceBanner={<FlowTraceOverlay />}
          impactBanner={<LiveImpactBanner />}
        />
      </div>
      <IdeInspector>
        <AnalysisStatusPanel />
        <AnalysisDemoToggle />
        <InspectorSection label="Function">
          <div className="ide-inspector-head">
            <div className="ide-inspector-name">
              <span className="ide-inspector-name-dot" />
              {fd.funcName}
              <span className="ide-inspector-name-loc">{fd.loc}</span>
            </div>
          </div>
          <IdeMetricRow metrics={liveMetrics} />
        </InspectorSection>

        <InspectorSection label="Signals">
          <IdePills items={livePills} />
        </InspectorSection>

        <InspectorSection label="Blast Radius">
          <BlastRadiusViz onNodeClick={navigateToFile} />
        </InspectorSection>

        <InspectorSection label="Call Graph">
          <IdeCallGraph nodes={fd.callGraph} onNodeClick={navigateToFile} />
        </InspectorSection>

        <InspectorSection label="Data Flow">
          <IdeDataFlow steps={fd.dataFlow} />
        </InspectorSection>

        <InspectorSection label="Suggested Fix">
          <button
            type="button"
            className="ide-btn"
            onClick={openSim}
            style={{ alignSelf: "flex-start", marginBottom: 4 }}
          >
            Simulate this change<span className="ide-btn-key">⌘⇧S</span>
          </button>
          <IdeSuggestedFix
            title="Insert sanitizer at line 6"
            code={
              <>
                <span>{"  const amount = req.body.amount;\n"}</span>
                <span className="add">{"+ const safe = sanitizeAmount(amount);\n"}</span>
                <span className="del">{"- await db.update(tx);\n"}</span>
                <span className="add">{"+ await db.update({ ...tx, amount: safe });"}</span>
              </>
            }
            meta={[
              { k: "Behavior", v: "equivalent" },
              { k: "Risk", v: "−1 path" },
              { k: "Confidence", v: "high" },
              { k: "Tests", v: "+2" },
            ]}
            onApply={() => { showToast("Fix applied — sanitizer inserted at line 6"); }}
            onDismiss={() => { showToast("Fix dismissed"); }}
          />
        </InspectorSection>

        <TimeTravelCompare />
      </IdeInspector>
      <LineInfoBar />
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
      <Toast />
    </div>
  );
}
