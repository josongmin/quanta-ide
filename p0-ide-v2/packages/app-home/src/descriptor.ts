import type { TabAppDescriptor } from "@quanta/shell-contract";
import { AnalysisCatalogApp, HomeApp, NewTabApp } from "./App";

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

export const analysisCatalogDescriptor: TabAppDescriptor = {
  id: "analysis-catalog",
  label: "Analysis Catalog",
  Component: AnalysisCatalogApp,
};
