import type { CSSProperties, ReactElement } from "react";
import { entityStore, useEntityState } from "../../../entities/entity";

// FocusModeChip
// --------------------------------------------------------------------
// Header chip that appears ONLY when the canvas is in "neighborhood"
// focus mode — a filtered view that hides every entity except the
// selected one and its 1-hop edges. The filter is invisible at a
// glance (entities just aren't there), so users who accidentally
// land in focus mode would otherwise be baffled by "why is half the
// canvas missing".
//
// Nielsen heuristic #1 (visibility of system status): the hidden
// mode must have a visible marker. The chip names the anchor
// entity + provides a one-click exit.
//
// Rendering nothing when focus is "none" keeps the header from
// reserving space for a control that doesn't apply — the other
// header clusters flow into the vacated spot.

const CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 8px 3px 10px",
  borderRadius: 999,
  background: "#eef2ff",
  color: "#3730a3",
  fontSize: 11,
  fontFamily: "system-ui, sans-serif",
  fontWeight: 500,
  border: "1px solid #c7d2fe",
};

const ANCHOR: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  maxWidth: 160,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const EXIT: CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  width: 16,
  height: 16,
  borderRadius: 999,
  cursor: "pointer",
  fontSize: 11,
  lineHeight: 1,
  color: "#4338ca",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

export function FocusModeChip(): ReactElement | null {
  const focusMode = useEntityState(s => s.interaction.focusMode);
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const tree = useEntityState(s => s.tree);
  if (focusMode !== "neighborhood") return null;
  const anchor = selectedId && tree ? tree.byId.get(selectedId) : null;

  return (
    <span style={CHIP} role="status" aria-live="polite">
      <span aria-hidden style={{ fontSize: 9, letterSpacing: 0.6, textTransform: "uppercase", color: "#6366f1" }}>
        Focus
      </span>
      <span style={ANCHOR}>{anchor?.name ?? "selection"}</span>
      <button
        type="button"
        style={EXIT}
        onClick={() => entityStore.setFocusMode("none")}
        aria-label="Exit focus mode"
        title="Exit focus mode"
      >
        ✕
      </button>
    </span>
  );
}
