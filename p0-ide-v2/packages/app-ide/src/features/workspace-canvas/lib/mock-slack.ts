// Mock Slack threads — Batch 8 (embeds.slackThread)
// ---------------------------------------------------------------------
// Fixture threads with a stable shape — matches what a slack adapter
// will emit once the real integration lands. `relatedFileIdHint` is a
// path suffix resolved against the live graph at runtime.

export interface SlackReply {
  readonly author: string;
  readonly body: string;
  readonly timestamp: number;
}

export interface SlackThread {
  readonly id: string;
  readonly channel: string;
  readonly url: string;
  readonly messageCount: number;
  readonly lastReply: SlackReply;
  /** Path-suffix hint used to link against a graph file id at bootstrap. */
  readonly relatedFileIdHint?: string;
}

// Deterministic base time — the dev canvas should render "n minutes
// ago" consistently across reloads without the clock drifting.
const BASE_TS = Date.UTC(2025, 9, 14, 9, 0, 0);

const THREADS: readonly SlackThread[] = [
  {
    id: "s-eng-canvas-1",
    channel: "#eng-canvas",
    url: "https://quanta.slack.com/archives/C0ENG/CANVAS1",
    messageCount: 12,
    lastReply: {
      author: "alice",
      body: "Refactored the taint propagation path — PR incoming.",
      timestamp: BASE_TS - 6 * 60_000,
    },
    relatedFileIdHint: "canvas-engine/graph/types.ts",
  },
  {
    id: "s-eng-canvas-2",
    channel: "#eng-canvas",
    url: "https://quanta.slack.com/archives/C0ENG/CANVAS2",
    messageCount: 4,
    lastReply: {
      author: "bob",
      body: "Does the worker-bridge debounce apply on incremental diffs too?",
      timestamp: BASE_TS - 21 * 60_000,
    },
    relatedFileIdHint: "workspace-canvas/hooks/use-worker-bridge.ts",
  },
  {
    id: "s-review-prs-1",
    channel: "#review-prs",
    url: "https://quanta.slack.com/archives/C0REVIEW/PR1",
    messageCount: 7,
    lastReply: {
      author: "carol",
      body: "LGTM after the snapshot-index rename — ping me when rebased.",
      timestamp: BASE_TS - 48 * 60_000,
    },
    relatedFileIdHint: "workspace-canvas/store/interaction-store.ts",
  },
  {
    id: "s-design-3",
    channel: "#design-canvas",
    url: "https://quanta.slack.com/archives/C0DESIGN/D3",
    messageCount: 18,
    lastReply: {
      author: "dan",
      body: "Replaced the left-color-stripe with a dot + glyph so the rule holds.",
      timestamp: BASE_TS - 2 * 60 * 60_000,
    },
  },
];

export function listMockSlackThreads(): readonly SlackThread[] {
  return THREADS;
}

export function resolveSlackRelatedFileId(
  thread: SlackThread,
  fileIds: readonly string[],
): string | undefined {
  const hint = thread.relatedFileIdHint;
  if (!hint) return undefined;
  return fileIds.find(id => id === hint || id.endsWith("/" + hint) || id.endsWith(hint));
}
