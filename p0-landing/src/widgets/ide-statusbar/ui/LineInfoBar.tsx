import { useEditorHover } from "@/features/ide-editor-hover";

export function LineInfoBar() {
  const hovered = useEditorHover((s) => s.hoveredLine);
  if (!hovered?.summary) return null;

  return (
    <div className="ide-lineinfo">
      <span className="ide-lineinfo-line">L{hovered.lineNo}</span>
      <span className="ide-lineinfo-summary">{hovered.summary}</span>
      {hovered.detail && (
        <>
          <span className="ide-lineinfo-sep" />
          <span className="ide-lineinfo-detail">{hovered.detail}</span>
        </>
      )}
    </div>
  );
}
