// File-extension inference for display.
//
// The canvas graph (mock or live) stores file entities by their path
// stem only — `canvas-engine/graph/types`, not `types.ts`. Everywhere we
// render a file name (explorer tree, mind-map, neighborhood) the
// extension is useful both as information ("is this a .tsx?") and as a
// hook for the per-extension icon set in `@quanta/ui-kit`. This helper
// gives us one consistent answer.

interface EntityLike {
  kind: string;
  name: string;
  path: string;
}

const UI_SEG = /(^|\/)(ui|widgets|components)($|\/)/;
const PASCAL_COMPONENT = /^[A-Z][A-Za-z0-9]*$/;

export function inferFileExt(path: string, name: string): string {
  if (/\.[a-z0-9]+$/i.test(name)) return "";
  const n = name.toLowerCase();
  if (n === "package") return ".json";
  if (n === "tsconfig") return ".json";
  if (n === "readme") return ".md";
  if (n === "dockerfile") return "";
  const p = path.toLowerCase();
  if (n === "ui" || UI_SEG.test(p) || PASCAL_COMPONENT.test(name)) return ".tsx";
  return ".ts";
}

export function fileDisplayName(entity: EntityLike): string {
  if (entity.kind !== "building") return entity.name;
  return entity.name + inferFileExt(entity.path, entity.name);
}
