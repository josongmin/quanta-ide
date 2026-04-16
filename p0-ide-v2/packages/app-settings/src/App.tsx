import type { TabAppProps } from "@quanta/shell-contract";
import { SettingsPage } from "@/pages/settings";

// Note: Settings is usually rendered as an overlay by Shell when settingsOpen is true,
// but can also be opened as a tab. This descriptor covers the tab case.
export function SettingsApp(_props: TabAppProps) {
  return <SettingsPage />;
}
