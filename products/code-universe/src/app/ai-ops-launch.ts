import type { ViewMode } from "../features/view-mode";

/**
 * AI Ops launch intent — same prime/consume pattern as
 * `universe-launch.ts`, but the consumer is the `ai-ops` top-level tab
 * (NOT the Code Universe canvas).
 */
export interface AiOpsLaunchIntent {
  mode?: ViewMode;
}

let pendingIntent: AiOpsLaunchIntent | null = null;

export function primeAiOpsLaunch(intent: AiOpsLaunchIntent): void {
  pendingIntent = intent;
}

export function consumeAiOpsLaunch(): AiOpsLaunchIntent | null {
  if (!pendingIntent) return null;
  const next = pendingIntent;
  pendingIntent = null;
  return next;
}
