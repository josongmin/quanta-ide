import type { TabAppDescriptor } from "@quanta/shell-contract";
import { IdeApp } from "./App";

export const ideAppDescriptor: TabAppDescriptor = {
  id: "ide",
  label: "IDE",
  Component: IdeApp,
};
