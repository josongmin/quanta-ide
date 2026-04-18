// Editor layout constants — single source for both CSS and TS.
//
// CM_LINE_PAD_PX matches the `--cm-line-pad` CSS var on `.editor__cm`
// and the `.cm-line` left padding in editorTheme. Block widgets that
// need to align to a line's first non-whitespace character must add
// this offset (they render at cm-content's left edge, not inside a
// cm-line). When changing this, update editor.css and Editor.tsx
// theme together — they MUST stay in sync.
export const CM_LINE_PAD_PX = 12;
