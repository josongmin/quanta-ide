import { useEffect, useMemo, useState } from "react";
import type { TabAppProps } from "@quanta/shell-contract";
import {
  consumeAiOpsLaunch,
  getViewDescriptor,
  listRuntimeViewDescriptors,
  type ViewDescriptor,
  type ViewMode,
} from "@quanta/code-universe";
import { AiOpsLauncher } from "./ui/AiOpsLauncher";
import { AiOpsViewHost } from "./ui/AiOpsViewHost";
import "./ui/ai-ops.css";

/**
 * AI Ops — top-level tab.
 *
 * Hosts every view whose primary scope is NOT workspace tree
 * (agent-run / task / model / budget / policy / diff / team / org).
 * Two states:
 *   - launcher: no active view → grid of cards grouped by domain
 *   - view-host: active view → the descriptor's Component rendered
 *     full-bleed, with a back-to-launcher button
 *
 * Active view is set either from a pending `AiOpsLaunchIntent` (set
 * just before `tabBus.open("ai-ops")`) or from the in-tab launcher.
 */
export function AiOpsApp(_props: TabAppProps) {
  const runtimeDescriptors = useMemo<readonly ViewDescriptor[]>(
    () => listRuntimeViewDescriptors(),
    [],
  );
  const [activeMode, setActiveMode] = useState<ViewMode | null>(() => {
    const pending = consumeAiOpsLaunch();
    return pending?.mode ?? null;
  });

  // Re-consume pending launches whenever this tab is (re)mounted — covers
  // the "open second AI Ops tab from the catalog" path where the intent
  // was primed before mount.
  useEffect(() => {
    const pending = consumeAiOpsLaunch();
    if (pending?.mode) setActiveMode(pending.mode);
  }, []);

  if (activeMode) {
    let descriptor: ViewDescriptor | null;
    try {
      descriptor = getViewDescriptor(activeMode);
    } catch {
      descriptor = null;
    }
    if (descriptor) {
      return (
        <AiOpsViewHost
          descriptor={descriptor}
          onBack={() => setActiveMode(null)}
        />
      );
    }
  }

  return (
    <AiOpsLauncher
      descriptors={runtimeDescriptors}
      onPick={(id) => setActiveMode(id)}
    />
  );
}
