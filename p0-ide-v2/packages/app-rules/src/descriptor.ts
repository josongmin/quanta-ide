import type { TabAppDescriptor } from "@quanta/shell-contract";
import { RulesApp } from "./App";

export const rulesDescriptor: TabAppDescriptor = {
  id: "rules" as TabAppDescriptor["id"],
  label: "Rules",
  Component: RulesApp,
};
