export function cn(...parts: (string | false | null | undefined)[]): string {
  let out = "";
  for (const p of parts) {
    if (!p) continue;
    if (out.length === 0) out = p;
    else out += " " + p;
  }
  return out;
}
