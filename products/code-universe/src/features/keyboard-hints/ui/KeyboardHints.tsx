import { useEffect, type CSSProperties, type ReactElement } from "react";
import { keyboardHintsStore, useKeyboardHints } from "../model/store";

// KeyboardHints
// --------------------------------------------------------------------
// Cheat-sheet modal listing every in-canvas shortcut, grouped by
// category (navigation / zoom / view / action). Grouping applies
// Hick's law in reverse: splitting 14 bindings into 4 clusters of
// ~3-4 each makes the table scannable in one pass.
//
// The `⌘` glyph is used as the platform-agnostic label for the
// primary modifier. Users learn the pattern visually; Mac users see
// their real key, Windows users read "Ctrl" in their head via muscle
// memory. A per-OS switch would be more correct but inflates the
// component with useless ceremony.

const OVERLAY: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.42)",
  display: "grid",
  placeItems: "center",
  zIndex: 120,
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
};

const PANEL: CSSProperties = {
  width: "min(560px, 92vw)",
  maxHeight: "80vh",
  overflowY: "auto",
  background: "white",
  borderRadius: 12,
  boxShadow: "0 18px 48px rgba(15, 23, 42, 0.22)",
  padding: "18px 22px 20px",
  fontFamily: "system-ui, sans-serif",
  color: "#1f2937",
};

const TITLE: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  marginBottom: 4,
};

const SUB: CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  marginBottom: 16,
};

const GROUP_HEAD: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "#6b7280",
  marginTop: 14,
  marginBottom: 6,
};

const ROW: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(80px, auto) 1fr",
  columnGap: 14,
  padding: "4px 0",
  fontSize: 12,
  alignItems: "center",
};

const KBD_BASE: CSSProperties = {
  fontFamily: "ui-monospace, Menlo, Monaco, monospace",
  fontSize: 10.5,
  background: "#f3f4f6",
  padding: "2px 6px",
  borderRadius: 4,
  border: "1px solid #e5e7eb",
  color: "#374151",
  whiteSpace: "nowrap",
};

interface Binding {
  keys: readonly string[];
  label: string;
}

const GROUPS: readonly { head: string; bindings: readonly Binding[] }[] = [
  {
    head: "Navigation",
    bindings: [
      { keys: ["⌘K", "Ctrl K"], label: "Command palette (entity search)" },
      { keys: ["Alt ←"], label: "History back" },
      { keys: ["Alt →"], label: "History forward" },
      { keys: ["↑ ↓ ← →"], label: "Pan camera" },
    ],
  },
  {
    head: "Zoom & tier",
    bindings: [
      { keys: ["⌘ wheel"], label: "Zoom at cursor" },
      { keys: ["⌘ +", "⌘ −"], label: "Keyboard zoom" },
      { keys: ["⌘ 0"], label: "Fit current tier" },
      { keys: ["⌘ ]", "⌘ ["], label: "Drill in / out one tier" },
      { keys: ["⌘ 1 … 6"], label: "Jump to tier by number" },
    ],
  },
  {
    head: "View",
    bindings: [
      { keys: ["Esc"], label: "Clear selection, then drill out" },
      { keys: ["Space + drag"], label: "Force-pan (ignores entity click)" },
      { keys: ["wheel"], label: "Two-finger scroll pan" },
      { keys: ["drag"], label: "Pan + release for inertia drift" },
    ],
  },
  {
    head: "Action",
    bindings: [
      { keys: ["N"], label: "New / edit sticky note on selection" },
      { keys: ["⌘ Shift S"], label: "Export viewport as PNG" },
      { keys: ["Click entity"], label: "Drill in + select" },
      { keys: ["?"], label: "Toggle this sheet" },
    ],
  },
];

export function KeyboardHints(): ReactElement | null {
  const open = useKeyboardHints(s => s.open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        keyboardHintsStore.close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={OVERLAY}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={e => {
        if (e.target === e.currentTarget) keyboardHintsStore.close();
      }}
    >
      <div style={PANEL} onClick={e => e.stopPropagation()}>
        <div style={TITLE}>Keyboard shortcuts</div>
        <div style={SUB}>Everything you can do from the canvas without touching the mouse.</div>
        {GROUPS.map(group => (
          <div key={group.head}>
            <div style={GROUP_HEAD}>{group.head}</div>
            {group.bindings.map(b => (
              <div key={b.label} style={ROW}>
                <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                  {b.keys.map((k, i) => (
                    <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <kbd style={KBD_BASE}>{k}</kbd>
                      {i < b.keys.length - 1 ? (
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>/</span>
                      ) : null}
                    </span>
                  ))}
                </span>
                <span style={{ color: "#374151" }}>{b.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
