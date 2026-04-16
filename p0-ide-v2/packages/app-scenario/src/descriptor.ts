import type { TabAppDescriptor } from "@quanta/shell-contract";
import { ScenarioApp } from "./App";

export const scenarioDescriptor: TabAppDescriptor = {
  id: "scenario",
  label: "Scenario",
  Component: ScenarioApp,
};
