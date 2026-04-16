import type { TabAppProps } from "@quanta/shell-contract";
import { RulesPage } from "@quanta/app-rules/pages/rules";

// Note: RulesModal is rendered by Shell globally, not here.
export function RulesApp(_props: TabAppProps) {
  return <RulesPage />;
}
