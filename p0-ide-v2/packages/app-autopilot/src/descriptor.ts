import type { TabAppDescriptor } from "@quanta/shell-contract";
import { AutopilotApp } from "./App";

export const autopilotDescriptor: TabAppDescriptor = {
  id: "autopilot",
  label: "Autopilot",
  Component: AutopilotApp,
};
