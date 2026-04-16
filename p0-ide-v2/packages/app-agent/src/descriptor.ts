import type { TabAppDescriptor } from "@quanta/shell-contract";
import { AgentApp } from "./App";

export const agentAppDescriptor: TabAppDescriptor = {
  id: "agent",
  label: "Agent",
  Component: AgentApp,
};
