export interface ShortcutBinding {
    /** Unique id, e.g. "palette.open". */
    id: string;
    /**
     * Human form, e.g. "mod+shift+p" or "cmd+shift+p".
     * `mod` resolves to Cmd on macOS / Ctrl elsewhere.
     * Recognised modifiers: `mod`, `ctrl`, `meta`, `shift`, `alt`.
     */
    keys: string;
    label: string;
    run: (e: KeyboardEvent) => void;
    /** Optional guard. Binding is skipped when it returns false. */
    when?: () => boolean;
    /** Higher priority wins when multiple bindings match. Default 0. */
    priority?: number;
    /**
     * Ignore the modifier state when matching. Useful for bare keys
     * like Escape that must fire regardless of mod/shift/alt.
     */
    ignoreMods?: boolean;
}
