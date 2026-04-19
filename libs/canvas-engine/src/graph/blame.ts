// Git blame overlay — per-line commit age used by the ground-tier gutter.
// The model mirrors what GitLens / GitHub file-view render: each line is
// attached to the commit that last touched it, and age drives a visual
// gradient ("is this hot code?" at a glance).

export interface BlameEntry {
  /** 1-based start line. */
  startLine: number;
  endLine: number;
  /** ms since epoch. Used for age-gradient color. */
  committedAt: number;
  author: string;
  commitSha?: string;
  message?: string;
}

export interface FileBlame {
  fileId: string;
  entries: readonly BlameEntry[];
  /** Overall range covered by blame (usually the file's entire line count). */
  lineCount: number;
}

export interface BlameStripe {
  fromLine: number;
  toLine: number;
  color: number;
  age: number;
}

// Fixed age buckets (ms). Ordered fresh → cold so `bucketForAge` can
// linear-scan. The ramp is intentionally logarithmic — a 1-week commit
// and a 1-year commit should read very differently, but 1-year vs
// 2-year converges on "old" so the eye isn't distracted.
const DAY = 86_400_000;
const TIER_BOUNDS: readonly number[] = [
  7 * DAY,    // ≤ 1 week  → hot
  30 * DAY,   // ≤ 1 month → warm
  90 * DAY,   // ≤ 3 months → amber
  180 * DAY,  // ≤ 6 months → cool
  365 * DAY,  // ≤ 1 year  → cold
];

// Chosen so GitLens-style readers can distinguish "worked on this week"
// (red-orange) from "refactored last quarter" (amber) from "vintage code"
// (blue). Values verified against 3:1 contrast on both light/dark card BGs.
const TIER_COLORS: readonly number[] = [
  0xef4444, // fresh    — red-orange, matches tailwind red-500
  0xf59e0b, // recent   — amber-500
  0xfbbf24, // moderate — amber-400
  0x60a5fa, // cool     — blue-400
  0x3b82f6, // cold     — blue-500
  0x1e3a8a, // vintage  — indigo-900 (anything older than a year)
];

function bucketForAge(ageMs: number): number {
  for (let i = 0; i < TIER_BOUNDS.length; i++) {
    if (ageMs <= TIER_BOUNDS[i]) return i;
  }
  return TIER_COLORS.length - 1;
}

export function ageColor(committedAt: number, now: number = Date.now()): number {
  const age = Math.max(0, now - committedAt);
  return TIER_COLORS[bucketForAge(age)];
}

// Merge heuristic: fold adjacent entries that fall into the same age
// bucket into a single stripe. This keeps paint cost proportional to
// visible "colour regions" instead of raw commit count — a file edited
// by one person in one session becomes a single stripe.
export function stripesFromBlame(
  blame: FileBlame,
  now: number = Date.now(),
): BlameStripe[] {
  if (blame.entries.length === 0) return [];
  const sorted = [...blame.entries].sort((a, b) => a.startLine - b.startLine);

  const stripes: BlameStripe[] = [];
  let cur: BlameStripe | null = null;

  for (const entry of sorted) {
    const age = Math.max(0, now - entry.committedAt);
    const bucket = bucketForAge(age);
    const color = TIER_COLORS[bucket];

    if (
      cur &&
      bucketForAge(cur.age) === bucket &&
      entry.startLine <= cur.toLine + 1
    ) {
      cur.toLine = Math.max(cur.toLine, entry.endLine);
      // Representative age for the merged stripe = oldest member,
      // so the sort order stays stable at the coarse bucket boundary.
      cur.age = Math.max(cur.age, age);
    } else {
      cur = { fromLine: entry.startLine, toLine: entry.endLine, color, age };
      stripes.push(cur);
    }
  }
  return stripes;
}
