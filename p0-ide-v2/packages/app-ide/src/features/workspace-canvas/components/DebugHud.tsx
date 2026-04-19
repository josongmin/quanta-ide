import { useEffect, useMemo, useState } from "react";
import { useDebugSettings, debugSettingsStore } from "../store/debug-settings-store";
import { WS_CLASSES } from "../lib/css-classes";
import { FloatingPanel } from "../../inspector-agent/ui/FloatingPanel";
import { FpsSection } from "./debug-hud/FpsSection";
import { LodSection } from "./debug-hud/LodSection";
import { SceneSection } from "./debug-hud/SceneSection";
import { RecorderControls } from "./debug-hud/RecorderControls";
import { SimulatorSection } from "./debug-hud/SimulatorSection";
import { GraphSection } from "./debug-hud/GraphSection";
import { AgentsSection } from "./debug-hud/AgentsSection";
import { FeaturesSection } from "./debug-hud/FeaturesSection";
import { FollowSection } from "./debug-hud/FollowSection";
import { ReviewSection } from "./debug-hud/ReviewSection";
import { ArchaeologyPanel } from "./debug-hud/ArchaeologyPanel";

// Panel is grouped into 4 top-level categories, each with a handful of sub-tabs.
// Two-level nav beats a flat 9-tab strip for scanability and lets us drop
// related sections into a single tab body without inventing more tabs.
type Tab = "fps" | "lod" | "scene" | "graph" | "archaeology" | "perf" | "agents" | "review" | "features";
type GroupId = "status" | "perf" | "collab" | "features";

const TAB_LABELS: Record<Tab, string> = {
  fps: "FPS",
  lod: "LOD",
  scene: "씬",
  graph: "그래프",
  archaeology: "고고학",
  perf: "레코더/시뮬",
  agents: "에이전트",
  review: "리뷰",
  features: "기능 플래그",
};

const GROUPS: readonly { id: GroupId; label: string; tabs: readonly Tab[] }[] = [
  { id: "status", label: "상태", tabs: ["scene", "fps", "lod", "graph", "archaeology"] },
  { id: "perf", label: "성능", tabs: ["perf"] },
  { id: "collab", label: "협업", tabs: ["agents", "review"] },
  { id: "features", label: "기능", tabs: ["features"] },
] as const;

// Floating, draggable, resizable debug panel. Collapses to its titlebar
// when the user hits the chevron so it stops obscuring the canvas.

export function DebugHud() {
  const open = useDebugSettings(s => s.debugHudOpen);
  const [group, setGroup] = useState<GroupId>("status");
  const [tab, setTab] = useState<Tab>("scene");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        debugSettingsStore.toggleDebugHud();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groupDef = useMemo(() => GROUPS.find(g => g.id === group) ?? GROUPS[0], [group]);

  // Keep tab inside the currently-selected group. If the user switches to a
  // group that doesn't contain the active tab, fall back to the group's first.
  useEffect(() => {
    if (!groupDef.tabs.includes(tab)) setTab(groupDef.tabs[0]);
  }, [group, groupDef, tab]);

  if (!open) {
    return (
      <button
        type="button"
        className={WS_CLASSES.debugToggle}
        onClick={() => debugSettingsStore.toggleDebugHud()}
        title="디버그 패널 표시 (⌘⇧D)"
      >
        디버그
      </button>
    );
  }

  return (
    <FloatingPanel
      title="디버그 패널"
      onClose={() => debugSettingsStore.toggleDebugHud()}
      defaultWidth={440}
      defaultHeight={600}
      minWidth={360}
      minHeight={240}
      collapsible
      variant="hud"
    >
      <div className={WS_CLASSES.debugGroups} role="tablist" aria-label="카테고리">
        {GROUPS.map(g => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={group === g.id}
            className={`${WS_CLASSES.debugGroupTab}${group === g.id ? " is-on" : ""}`}
            onClick={() => setGroup(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className={WS_CLASSES.debugTabs} role="tablist" aria-label="서브 탭">
        {groupDef.tabs.map(t => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`${WS_CLASSES.debugTab}${tab === t ? " is-on" : ""}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div className={WS_CLASSES.debugBody}>
        {tab === "fps" && (
          <div className={WS_CLASSES.debugGrid}>
            <FpsSection />
          </div>
        )}
        {tab === "lod" && <LodSection />}
        {tab === "scene" && <SceneSection />}
        {tab === "graph" && <GraphSection />}
        {tab === "archaeology" && <ArchaeologyPanel />}
        {tab === "perf" && (
          <>
            <RecorderControls />
            <SimulatorSection />
          </>
        )}
        {tab === "agents" && (
          <>
            <AgentsSection />
            <FollowSection />
          </>
        )}
        {tab === "review" && <ReviewSection />}
        {tab === "features" && <FeaturesSection />}
      </div>
    </FloatingPanel>
  );
}
