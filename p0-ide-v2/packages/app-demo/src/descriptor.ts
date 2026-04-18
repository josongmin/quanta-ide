import type { TabAppDescriptor } from "@quanta/shell-contract";
import { DemoApp } from "./App";

export const demoDescriptor: TabAppDescriptor = {
  id: "demo",
  label: "Try demo",
  Component: DemoApp,
};
