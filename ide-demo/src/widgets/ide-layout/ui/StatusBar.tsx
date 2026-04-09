import { useEditorStore } from "@/app/stores/useEditorStore";
import { usePanelStore } from "@/app/stores/usePanelStore";

export function StatusBar() {
  const { activeFile, cursorLine } = useEditorStore();
  const { toggleLeft, toggleRight, setCommandPalette } = usePanelStore();

  return (
    <div className="h-7 flex items-center px-3 text-[10px] font-mono text-text-muted shrink-0 select-none">
      <button type="button" onClick={toggleLeft} className="hover:text-text-primary transition-colors px-1">
        ☰
      </button>

      <span className="mx-2 text-border">|</span>
      <span className="text-text-secondary truncate max-w-[200px]">{activeFile}</span>

      <span className="mx-2 text-border">|</span>
      <span className="tabular-nums">Ln {cursorLine}</span>

      <span className="mx-2 text-border">|</span>
      <span>TypeScript</span>

      <span className="mx-2 text-border">|</span>
      <span>UTF-8</span>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => setCommandPalette(true)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-brand/10 hover:bg-brand/20 text-brand/70 hover:text-brand transition-colors"
        >
          <span>⌘K</span>
        </button>

        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-risk-safe animate-pulse" />
          <span className="text-risk-safe">p0 connected</span>
        </span>

        <button type="button" onClick={toggleRight} className="hover:text-text-primary transition-colors">
          Analysis
        </button>
      </div>
    </div>
  );
}
