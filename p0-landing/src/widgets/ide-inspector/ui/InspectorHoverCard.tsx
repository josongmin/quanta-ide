import { useEditorHover } from "@/features/ide-editor-hover";

export function InspectorHoverCard() {
  const hovered = useEditorHover((s) => s.hoveredLine);
  if (!hovered) return null;

  return (
    <div className="ide-inspector-hover">
      <div className="ide-inspector-hover-head">
        <span className="ide-inspector-hover-line">Line {hovered.lineNo}</span>
        {hovered.summary && (
          <span className="ide-inspector-hover-summary">{hovered.summary}</span>
        )}
      </div>
      {hovered.detail && (
        <div className="ide-inspector-hover-detail">{hovered.detail}</div>
      )}
    </div>
  );
}
