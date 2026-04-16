import type { TabAppDescriptor } from "@quanta/shell-contract";
import { PrApp } from "./App";

export const prAppDescriptor: TabAppDescriptor = {
  id: "pr",
  label: "PR Review",
  Component: PrApp,
};
