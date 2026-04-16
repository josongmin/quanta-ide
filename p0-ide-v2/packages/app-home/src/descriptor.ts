import type { TabAppDescriptor } from "@quanta/shell-contract";
import { HomeApp, NewTabApp } from "./App";

export const homeDescriptor: TabAppDescriptor = {
  id: "home",
  label: "Home",
  Component: HomeApp,
};

export const newTabDescriptor: TabAppDescriptor = {
  id: "new-tab",
  label: "New Tab",
  Component: NewTabApp,
};
