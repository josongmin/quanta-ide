import { useMemo, type ReactNode } from "react";
import { ShellProvider, IconPackProvider } from "@quanta/shell-contract";
import type { TabApp } from "@quanta/shell-contract";
import { useIconPack } from "@quanta/shell/stores/icon-pack-store";
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
  const packId = useIconPack();
  return (
    <ShellProvider value={api}>
      <IconPackProvider value={packId}>
        {children}
      </IconPackProvider>
    </ShellProvider>
  );
}
