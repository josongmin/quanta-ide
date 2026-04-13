import { useCallback, useRef } from "react";
import type { LineMeta } from "@/app/ide/mock-source";
import { useCodeMirror } from "./useCodeMirror";

interface EditableEditorProps {
  tabs: { name: string; active?: boolean }[];
  source: string;
  lineMeta?: Record<number, LineMeta>;
  onTabClick?: (name: string) => void;
  onTabClose?: (name: string) => void;
  onChange?: (code: string, changedLine: number) => void;
  impactBanner?: React.ReactNode;
  flowTraceBanner?: React.ReactNode;
}

export function EditableEditor({
  tabs,
  source,
  lineMeta = {},
  onTabClick,
  onTabClose,
  onChange,
  impactBanner,
  flowTraceBanner,
}: EditableEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  useCodeMirror(editorRef, source, lineMeta, onChange);

  const handleTabClose = useCallback((name: string) => {
    onTabClose?.(name);
  }, [onTabClose]);

  return (
    <main className="ide-editor">
      <div className="ide-editor-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            type="button"
            className={`ide-editor-tab${tab.active ? " is-active" : ""}`}
            onClick={() => onTabClick?.(tab.name)}
          >
            <span>{tab.name}</span>
            {onTabClose && (
              <span
                className="ide-editor-tab-close"
                role="button"
                tabIndex={0}
                aria-label={`Close ${tab.name}`}
                onClick={(e) => { e.stopPropagation(); handleTabClose(tab.name); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTabClose(tab.name);
                  }
                }}
              >
                ×
              </span>
            )}
          </button>
        ))}
      </div>
      {flowTraceBanner}
      <div className="ide-editor-body editable-editor-body" ref={editorRef} />
      {impactBanner}
    </main>
  );
}
