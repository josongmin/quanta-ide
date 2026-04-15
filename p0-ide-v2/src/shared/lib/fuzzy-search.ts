/* ──────────────────────────────────────────────────────────────────
   Fuzzy match: subsequence with position capture for highlighting.
   ────────────────────────────────────────────────────────────────── */
export function matchPositions(haystack: string, needle: string): number[] | null {
  if (needle.length === 0) return [];
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  const out: number[] = [];
  let cursor = 0;
  for (let i = 0; i < n.length; i++) {
    const ch = n[i];
    const idx = h.indexOf(ch, cursor);
    if (idx === -1) return null;
    out.push(idx);
    cursor = idx + 1;
  }
  return out;
}

export function positionScore(positions: readonly number[]): number {
  if (positions.length === 0) return 0;
  const start = positions[0];
  const span = positions[positions.length - 1] - start;
  // penalize long spans + late starts; reward consecutive runs.
  let gaps = 0;
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] !== positions[i - 1] + 1) gaps += 1;
  }
  return start * 2 + span + gaps * 4;
}
