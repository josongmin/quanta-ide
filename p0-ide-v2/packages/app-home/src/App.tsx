import type { TabAppProps } from "@quanta/shell-contract";
import { HomePage } from "@quanta/app-home/pages/home";
import { NewTabPage } from "@quanta/app-home/pages/new-tab";

// Home is rendered as an overlay by Shell when homeOpen is true.
export function HomeApp(_props: TabAppProps) {
  return <HomePage />;
}

// new-tab is rendered as a regular tab.
export function NewTabApp(_props: TabAppProps) {
  return <NewTabPage />;
}
