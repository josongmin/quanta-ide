import { useActiveFile } from "./model/useActiveFile";
import { FILE_NAMES, type FileName } from "./model/fileRegistry";

export function useIdeFileNavigation(setFileContext: (name: string) => void) {
  const active = useActiveFile((s) => s.active);
  const tabs = useActiveFile((s) => s.tabs);
  const setActive = useActiveFile((s) => s.setActive);
  const openTab = useActiveFile((s) => s.openTab);
  const closeTab = useActiveFile((s) => s.closeTab);

  const navigateToFile = (name: string) => {
    const match = FILE_NAMES.find((f) => f === name || name.endsWith(f));
    if (match) {
      openTab(match);
      setFileContext(match);
    }
  };

  return { active, tabs, setActive, openTab, closeTab, navigateToFile, FILE_NAMES };
}
