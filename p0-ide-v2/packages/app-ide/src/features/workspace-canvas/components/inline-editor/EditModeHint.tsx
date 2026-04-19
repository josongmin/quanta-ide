import { useInlineEditorStore } from "../../store/inline-editor-store";

// EditModeHint
// -------------------------------------------------------------------
// Floating keyboard legend shown only while an inline edit session is
// active. Surfaces the (otherwise invisible) Cmd+K AI edit affordance
// plus the commit / exit chords so first-time users don't have to
// discover them by luck. Positioned bottom-center of the canvas
// viewport so it floats above the editing card without colliding with
// CanvasControls (bottom-right) or the minimap (bottom-left).

export function EditModeHint() {
  const editingFileId = useInlineEditorStore(s => s.editingFileId);
  const aiOpen = useInlineEditorStore(s => s.ai.status !== "idle");
  if (!editingFileId) return null;

  return (
    <div
      className="edit-mode-hint"
      role="status"
      aria-live="polite"
      aria-label="Inline edit mode keyboard shortcuts"
    >
      <span className="edit-mode-hint__pill edit-mode-hint__pill--accent">
        <span className="edit-mode-hint__dot" />
        Editing
      </span>
      <span className="edit-mode-hint__sep" />
      {!aiOpen && (
        <>
          <Chord keys={["⌘", "K"]} label="AI edit" accent />
          <Chord keys={["⇥"]} label="indent" />
          <Chord keys={["⌘", "⏎"]} label="commit" />
          <Chord keys={["⎋"]} label="exit" />
        </>
      )}
      {aiOpen && (
        <>
          <Chord keys={["⏎"]} label="generate" accent />
          <Chord keys={["⇥"]} label="accept" />
          <Chord keys={["⎋"]} label="cancel" />
        </>
      )}
    </div>
  );
}

interface ChordProps {
  keys: readonly string[];
  label: string;
  accent?: boolean;
}

function Chord({ keys, label, accent }: ChordProps) {
  return (
    <span className={`edit-mode-hint__chord${accent ? " edit-mode-hint__chord--accent" : ""}`}>
      {keys.map((k, i) => (
        <kbd key={i} className="edit-mode-hint__kbd">{k}</kbd>
      ))}
      <span className="edit-mode-hint__label">{label}</span>
    </span>
  );
}
