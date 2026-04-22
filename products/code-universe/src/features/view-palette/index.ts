// view-palette — public barrel
// --------------------------------------------------------------------
// Global ⌘⇧P / Ctrl+⇧P modal for jumping between the 74 view modes.
// Sibling to `features/view-mode/ViewModePicker` (sidebar picker) —
// same underlying registry, different UX surface (keyboard-first vs.
// discovery-first).
//
// Distinct from `features/command-palette/` which searches entities
// (files / symbols), not view modes.

export { ViewPalette } from "./ui/ViewPalette";
export { useViewPaletteShortcut } from "./model/use-view-palette-shortcut";
export { viewPaletteStore } from "./model/store";
