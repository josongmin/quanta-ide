// Pure formatting / parsing helpers for the Agent pane.

export function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

export function parseTokDelta(s: string): number {
  const m = s.match(/\+?([\d.]+)([km])?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const mult = m[2]?.toLowerCase() === "k" ? 1000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : 1;
  return n * mult;
}
