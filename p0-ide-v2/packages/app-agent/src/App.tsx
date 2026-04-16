import type { TabAppProps } from "@quanta/shell-contract";
import { AgentPage } from "@/pages/agent";

/**
 * Agent tab application.
 *
 * Phase A: thin wrapper around the existing AgentPage.
 * AgentPage is self-contained (owns its own chat state, session sidebar,
 * and source panel), so no additional context bridging is needed.
 */
export function AgentApp(_props: TabAppProps) {
  return <AgentPage />;
}
