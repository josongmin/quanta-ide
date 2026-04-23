/** Deterministic id utilities. */

export function shortId(prefix: string, n: number): string {
  return `${prefix}_${n.toString(36).padStart(4, "0")}`;
}

let counter = 1_000;
export function genId(prefix: string): string {
  counter += 1;
  return shortId(prefix, counter);
}
