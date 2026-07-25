import type { TabAppDescriptor } from "@quanta/shell-contract";
import { AiOpsApp } from "./App";

export const aiOpsDescriptor: TabAppDescriptor = {
  id: "ai-ops" as TabAppDescriptor["id"],
  label: "AI Ops",
  Component: AiOpsApp,
};
