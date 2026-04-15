import { useState } from "react";
import {
  ComplianceSection,
  ContextPanel,
  DetailDrawer,
  EnginePaybackCard,
  GroundingSection,
  MemoryPanel,
  Timescrubber,
  TodoPanel,
  TokenMeter,
  session,
  type DetailKind,
} from "./agent-pane";

export function AgentPane() {
  const [detail, setDetail] = useState<DetailKind | null>(null);

  return (
    <div className="pane pane--agent">
      <div className="pb-toolbar">
        <span className="pb-panel-title">Agent</span>
        <span className="pb-toolbar-sep" aria-hidden />
        <span className="agst__toolbar-meta">
          <span className="agst__model">{session.model}</span>
          <span className="agst__sep">·</span>
          <span className="agst__runtime">session {session.runtime}</span>
          <span className="agst__sep">·</span>
          <span className="agst__cache">cache {session.cache}</span>
        </span>
        <div className="pb-toolbar-spacer" />
        <span className="ag-engine-state">
          <span className="ag-engine-state__dot" aria-hidden />
          engine ready
        </span>
      </div>

      <div className="agst-pitch">
        <span className="agst-pitch__lead">Agent state.</span>
        <span className="agst-pitch__body">
          What the agent is carrying right now — context window, token budget, persistent memory, and the global todo
          list. Inspect and prune; the analysis lives in the right-side inspector.
        </span>
      </div>

      <Timescrubber />

      <EnginePaybackCard />

      <TokenMeter onOpenLog={() => setDetail("meter")} />

      <GroundingSection />

      <ComplianceSection />

      <div className="agst-grid">
        <ContextPanel onOpenLog={() => setDetail("ctx")} />
        <MemoryPanel onOpenLog={() => setDetail("mem")} />
        <TodoPanel onOpenLog={() => setDetail("todo")} />
      </div>

      {detail && <DetailDrawer kind={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
