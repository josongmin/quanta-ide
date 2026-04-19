export type FileTypeKey =
  | "py"
  | "ts"
  | "tsx"
  | "js"
  | "jsx"
  | "css"
  | "html"
  | "json"
  | "md"
  | "ini"
  | "go"
  | "rs"
  | "rb"
  | "java"
  | "yml"
  | "sh"
  | "dockerfile"
  | "txt";

export interface FileTypeMeta {
  label: string;
  tint?: string;
}

export const FILE_TYPE_META: Record<FileTypeKey, FileTypeMeta> = {
  py: { label: "py", tint: "#4b8bbe" },
  ts: { label: "ts", tint: "#3178c6" },
  tsx: { label: "tsx", tint: "#3178c6" },
  js: { label: "js", tint: "#f0db4f" },
  jsx: { label: "jsx", tint: "#f0db4f" },
  css: { label: "css", tint: "#264de4" },
  html: { label: "html", tint: "#e34c26" },
  json: { label: "{}", tint: "#fbbf24" },
  md: { label: "md", tint: "#8e8e93" },
  ini: { label: "ini", tint: "#9b5de5" },
  go: { label: "go", tint: "#00acd7" },
  rs: { label: "rs", tint: "#dea584" },
  rb: { label: "rb", tint: "#cc342d" },
  java: { label: "java", tint: "#ea2d2e" },
  yml: { label: "yml", tint: "#cb171e" },
  sh: { label: "sh", tint: "#4caf50" },
  dockerfile: { label: "dkr", tint: "#2496ed" },
  txt: { label: "txt", tint: "#8e8e93" },
};

export function detectFileType(filename: string): FileTypeKey | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".py")) return "py";
  if (lower.endsWith(".tsx")) return "tsx";
  if (lower.endsWith(".ts")) return "ts";
  if (lower.endsWith(".jsx")) return "jsx";
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "js";
  if (lower.endsWith(".css") || lower.endsWith(".scss")) return "css";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return "md";
  if (lower.endsWith(".toml") || lower.endsWith(".ini") || lower.endsWith(".cfg")) return "ini";
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".rs")) return "rs";
  if (lower.endsWith(".rb")) return "rb";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "yml";
  if (lower.endsWith(".sh") || lower.endsWith(".bash") || lower.endsWith(".zsh")) return "sh";
  if (lower.endsWith(".dockerfile") || lower === "dockerfile") return "dockerfile";
  if (lower.endsWith(".txt") || lower.endsWith(".log")) return "txt";
  return null;
}
