import type { TabAppDescriptor } from "@quanta/shell-contract";
import { DashboardApp } from "./App";

export const dashboardDescriptor: TabAppDescriptor = {
  id: "dashboard",
  label: "Dashboard",
  Component: DashboardApp,
};
