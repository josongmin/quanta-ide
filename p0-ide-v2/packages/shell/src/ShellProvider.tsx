import { useMemo, type ReactNode } from "react";
import { ShellProvider } from "@quanta/shell-contract";
import type { TabApp } from "@quanta/shell-contract";
import { createShellAPI } from "./create-shell-api";

interface TabActions {
  openTab: (app: TabApp, label: string) => void;
  closeTab: (id: string) => void;
  selectTab: (id: string) => void;
}

interface ShellProviderWrapperProps {
  children: ReactNode;
  tabActions: TabActions;
}

export function ShellProviderWrapper({ children, tabActions }: ShellProviderWrapperProps) {
  const api = useMemo(() => createShellAPI(tabActions), [tabActions]);
  return <ShellProvider value={api}>{children}</ShellProvider>;
}
