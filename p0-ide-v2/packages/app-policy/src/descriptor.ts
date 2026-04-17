import type { TabAppDescriptor } from "@quanta/shell-contract";
import { PolicyApp } from "./App";

export const policyDescriptor: TabAppDescriptor = {
  id: "policy" as TabAppDescriptor["id"],
  label: "Policy",
  Component: PolicyApp,
};
