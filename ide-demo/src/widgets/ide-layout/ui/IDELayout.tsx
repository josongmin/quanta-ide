import { useState, useCallback } from "react";
import { usePanelStore } from "@/app/stores/usePanelStore";
import { FileTree } from "@/widgets/file-tree/ui/FileTree";
import { EditorPane } from "@/widgets/editor/ui/EditorPane";
import { RiskBar } from "@/widgets/risk-bar/ui/RiskBar";
import { CallGraphPanel } from "@/features/call-graph/ui/CallGraphPanel";
import { StatusBar } from "@/widgets/ide-layout/ui/StatusBar";
import { ContextMenu } from "@/features/context-menu/ui/ContextMenu";
import { HoverCard } from "@/features/hover-card/ui/HoverCard";
import { CommandPalette } from "@/features/command-palette/ui/CommandPalette";
import { ChangeImpactToast } from "@/features/change-impact/ui/ChangeImpactToast";
import { TaintOverlay } from "@/features/taint-flow/ui/TaintOverlay";
import { OnboardingHint } from "@/features/onboarding/ui/OnboardingHint";
import { ResizeHandle } from "@/shared/ui/ResizeHandle";
import { cn } from "@/shared/lib/cn";

export function IDELayout() {
  const { leftOpen, rightOpen } = usePanelStore();
  const [leftWidth, setLeftWidth] = useState(228);
  const [rightWidth, setRightWidth] = useState(308);

  const resizeLeft = useCallback((delta: number) => {
    setLeftWidth((w) => Math.max(180, Math.min(420, w + delta)));
  }, []);

  const resizeRight = useCallback((delta: number) => {
    setRightWidth((w) => Math.max(240, Math.min(520, w + delta)));
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-paper">
      {/* Top — Risk bar */}
      <div className="shrink-0 border-b border-line bg-paper">
        <RiskBar />
      </div>

      {/* Main 3-col */}
      <div className="flex flex-1 min-h-0">
        {/* File tree */}
        <div
          className={cn(
            "shrink-0 overflow-hidden bg-paper border-r border-line transition-[width] duration-150",
            !leftOpen && "!w-0 !border-r-0"
          )}
          style={{ width: leftOpen ? leftWidth : 0 }}
        >
          <FileTree />
        </div>

        {leftOpen && <ResizeHandle side="left" onResize={resizeLeft} />}

        {/* Editor */}
        <div className="flex-1 min-w-0 relative bg-paper-2">
          <EditorPane />
          <TaintOverlay />
        </div>

        {rightOpen && <ResizeHandle side="right" onResize={resizeRight} />}

        {/* Analysis panel */}
        <div
          className={cn(
            "shrink-0 overflow-hidden bg-paper border-l border-line transition-[width] duration-150",
            !rightOpen && "!w-0 !border-l-0"
          )}
          style={{ width: rightOpen ? rightWidth : 0 }}
        >
          <CallGraphPanel />
        </div>
      </div>

      {/* Status */}
      <div className="shrink-0 border-t border-line bg-paper">
        <StatusBar />
      </div>

      {/* Overlays */}
      <ContextMenu />
      <HoverCard />
      <CommandPalette />
      <ChangeImpactToast />
      <OnboardingHint />
    </div>
  );
}
