import type { Layer } from "@quanta/app-ide/entities/symbol";

/** Convert a class name to a module path (CamelCase -> snake_case). */
export function derivePath(name: string, layer?: Layer): string {
  const className = name.split(".")[0];
  const snake = className
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
  return layer ? `${layer}/${snake}.py` : `${snake}.py`;
}

/** Find symbol position in a source line. Returns undefined if not found. */
export function findSymbolInLine(
  sourceLines: string[],
  line: number,
  symbol: string,
): { col: number; len: number } | undefined {
  if (line < 1 || line > sourceLines.length) return undefined;
  const text = sourceLines[line - 1];
  const shortName = symbol.split(".").pop() ?? symbol;
  const idx = text.indexOf(shortName);
  if (idx >= 0) return { col: idx, len: shortName.length };
  const fullIdx = text.indexOf(symbol);
  if (fullIdx >= 0) return { col: fullIdx, len: symbol.length };
  return undefined;
}

/** Deterministic color from a string -- 8-color palette. */
const PALETTE = [
  "#6366f1", "#0891b2", "#059669", "#d97706",
  "#dc2626", "#7c3aed", "#2563eb", "#ea580c",
];

export function symbolColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

/** Detect terminal endpoint kind from name heuristics. */
export function detectTerminalKind(
  name: string,
): "db" | "cache" | "queue" | "api" | "storage" | undefined {
  const lower = name.toLowerCase();
  if (lower.includes("postgres") || lower.includes("mysql") || lower.includes("sqlite") || lower.includes("mongo") || lower.includes("sql") || lower.includes("db")) return "db";
  if (lower.includes("redis") || lower.includes("memcache") || lower.includes("cache")) return "cache";
  if (lower.includes("kafka") || lower.includes("rabbit") || lower.includes("queue") || lower.includes("sqs")) return "queue";
  if (lower.includes("http") || lower.includes("grpc") || lower.includes("fetch")) return "api";
  if (lower.includes("s3") || lower.includes("storage") || lower.includes("blob") || lower.includes("file_store")) return "storage";
  return undefined;
}
