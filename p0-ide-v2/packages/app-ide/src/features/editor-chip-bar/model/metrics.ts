// Editor layout constants — single source for both CSS and TS.
// Mirror these in editor.css as `--cm-line-pad` / `--cm-gutter-w`
// (see editor.css :root scope on .cm-editor).
//
// CM_LINE_PAD_PX: matches `.cm-line { padding-left }` from editorTheme.
// Block widgets that need to align to the line's first character must
// add this offset (since widgets render at cm-content's left edge,
// not inside a cm-line).
//
// CM_GUTTER_OVERHANG_PX: how far the file-header chip bar reaches
// leftward into the gutter area for visual emphasis.
export const CM_LINE_PAD_PX = 12;
export const CM_GUTTER_OVERHANG_PX = 30;
