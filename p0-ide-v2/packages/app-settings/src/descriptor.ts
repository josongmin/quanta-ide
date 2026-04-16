import type { TabAppDescriptor } from "@quanta/shell-contract";
import { SettingsApp } from "./App";

export const settingsDescriptor: TabAppDescriptor = {
  id: "settings",
  label: "Settings",
  Component: SettingsApp,
};
