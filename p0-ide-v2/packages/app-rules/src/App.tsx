import { useEffect } from "react";
import { useShell, type TabAppProps } from "@quanta/shell-contract";
import { RulesPage } from "@quanta/app-rules/pages/rules";
import { RulesModal } from "@quanta/app-rules/pages/rules";

export function RulesApp(_props: TabAppProps) {
  const shell = useShell();

  // Register the global RulesModal overlay so it renders at shell level.
  useEffect(() => {
    return shell.registerOverlay("rules-modal", RulesModal);
  }, [shell]);

  return <RulesPage />;
}
