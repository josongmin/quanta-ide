import type { TabAppDescriptor } from "@quanta/shell-contract";
import { TokenRadarApp } from "./App";

export const tokenRadarDescriptor: TabAppDescriptor = {
  id: "token-radar" as TabAppDescriptor["id"],
  label: "TokenRadar",
  Component: TokenRadarApp,
};
