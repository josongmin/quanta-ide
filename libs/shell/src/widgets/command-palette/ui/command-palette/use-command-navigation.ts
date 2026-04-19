import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { featureRegistry } from "@quanta/shell/stores/feature-registry";
import { markRecent } from "./command-palette.utils";
import type { CommandEntry } from "./command-palette.types";

interface UseCommandNavigationArgs {
  visualOrder: readonly CommandEntry[];
  rawQuery: string;
  onClose: () => void;
}

interface UseCommandNavigationResult {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  runAt: (index: number) => void;
  handleKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
}

export function useCommandNavigation({
  visualOrder,
  rawQuery,
  onClose,
}: UseCommandNavigationArgs): UseCommandNavigationResult {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [rawQuery]);

  useEffect(() => {
    if (selectedIndex >= visualOrder.length) {
      setSelectedIndex(visualOrder.length > 0 ? visualOrder.length - 1 : 0);
    }
  }, [visualOrder.length, selectedIndex]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const row = list.querySelector<HTMLElement>(`[data-palette-index="${selectedIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const runAt = useCallback(
    (index: number) => {
      const entry = visualOrder[index];
      if (!entry) return;
      const ok = featureRegistry.runCommand(entry.command.id);
      if (ok) {
        markRecent(entry.command.id);
        onClose();
      }
    },
    [visualOrder, onClose],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown" || (e.ctrlKey && e.key.toLowerCase() === "n")) {
        e.preventDefault();
        if (visualOrder.length === 0) return;
        setSelectedIndex((i) => (i + 1) % visualOrder.length);
        return;
      }
      if (e.key === "ArrowUp" || (e.ctrlKey && e.key.toLowerCase() === "p")) {
        e.preventDefault();
        if (visualOrder.length === 0) return;
        setSelectedIndex((i) => (i - 1 + visualOrder.length) % visualOrder.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        runAt(selectedIndex);
      }
    },
    [visualOrder.length, onClose, runAt, selectedIndex],
  );

  return { selectedIndex, setSelectedIndex, listRef, runAt, handleKeyDown };
}
