import type { ReactElement } from "react";
import type { TabAppProps } from "@quanta/shell-contract";
import { CodeCityTabApp } from "@quanta/code-universe";

export function CodeCityApp(props: TabAppProps): ReactElement {
  return <CodeCityTabApp tabId={props.tabId} isActive={props.isActive} />;
}
