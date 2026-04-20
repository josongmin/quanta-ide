// Public API — command palette feature slice.
// Only `CommandPalette` (UI) + `useCommandPaletteShortcut` (binding)
// leak out. The store + search helpers stay internal.
export { CommandPalette } from "./ui/CommandPalette";
export { useCommandPaletteShortcut } from "./model/use-command-palette-shortcut";
export { commandPaletteStore } from "./model/store";
