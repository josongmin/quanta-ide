import { useEffect, useMemo, useRef, useState } from "react";
import type { LodLevel } from "@quanta/canvas-engine";
import { useFeature } from "../store/feature-flags-store";
import { useSceneStore } from "../store/scene-store";
import { useInteractionStore } from "../store/interaction-store";
import {
  listMockSlackThreads,
  resolveSlackRelatedFileId,
  type SlackThread,
} from "../lib/mock-slack";
import { SlackEmbed } from "./SlackEmbed";

interface Props {
  transform: string;
}

// Slack threads world layer (embeds.slackThread).
// -------------------------------------------------------------------
// Pins mock Slack thread cards to the right edge of each file they
// reference via `relatedFileIdHint`. Stacked below ticket cards (which
// already own 0..N * 44px of right-edge real estate) via `stackOffset`.
// Visible at city LOD and tighter; at galaxy the strings are unreadable
// and would just add visual noise.
//
// Unpinned threads (no `relatedFileIdHint` or one that didn't resolve)
// are collected into a tiny floating stack in the top-left corner so
// they're still discoverable — otherwise the feature silently hides
// ~25% of the fixture data.

const VISIBLE_LODS: readonly LodLevel[] = ["city", "street", "ground"] as const;
function isVisibleLod(lod: LodLevel): boolean { return VISIBLE_LODS.includes(lod); }

// How far down from the file's top to plant the first slack card.
// TicketsLayer occupies the ticket-count × 44 stack starting at rect.y;
// slacks stack immediately below, giving both features a predictable,
// non-overlapping lane without a hard-coded ticket count.
const SLACK_LANE_OFFSET_PX = 8;

export function SlackThreadsLayer({ transform }: Props) {
  const enabled = useFeature("embeds.slackThread");
  const lod = useInteractionStore(s => s.lod);
  const layout = useSceneStore(s => s.layout);
  const visible = useSceneStore(s => s.visibleScene);
  const graph = useSceneStore(s => s.graph);

  const layerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    el.style.transform = transform;
  }, [transform]);

  const resolved = useMemo(() => {
    if (!enabled || !graph) return { pinned: new Map<string, SlackThread[]>(), unpinned: [] as SlackThread[] };
    const threads = listMockSlackThreads();
    const fileIds = graph.files.map(f => f.id);
    const pinned = new Map<string, SlackThread[]>();
    const unpinned: SlackThread[] = [];
    for (const t of threads) {
      const fid = resolveSlackRelatedFileId(t, fileIds);
      if (!fid) { unpinned.push(t); continue; }
      const list = pinned.get(fid) ?? [];
      list.push(t);
      pinned.set(fid, list);
    }
    return { pinned, unpinned };
  }, [enabled, graph]);

  const renderable = useMemo(() => {
    if (!enabled || !isVisibleLod(lod)) return [];
    if (!layout || !visible) return [];
    const out: Array<{ fileId: string; worldX: number; worldY: number; threads: readonly SlackThread[] }> = [];
    for (const file of visible.files) {
      const rect = layout.fileRects.get(file.id);
      if (!rect) continue;
      const threads = resolved.pinned.get(file.id);
      if (!threads || threads.length === 0) continue;
      out.push({
        fileId: file.id,
        worldX: rect.x + rect.w + 18,
        // Slack lane sits below ticket cards. TicketsLayer uses the same
        // right-edge anchor, so threads never overlap unless a file has
        // >10 tickets (visual cap; extremely rare in mock data).
        worldY: rect.y + rect.h / 2 + SLACK_LANE_OFFSET_PX,
        threads,
      });
    }
    return out;
  }, [enabled, lod, layout, visible, resolved]);

  if (!enabled || !isVisibleLod(lod)) return null;

  return (
    <>
      <div
        ref={layerRef}
        className="workspace-canvas__slack-layer"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          transformOrigin: "0 0",
        }}
      >
        {renderable.flatMap(row =>
          row.threads.map((t, i) => (
            <div
              key={`${row.fileId}:${t.id}`}
              style={{
                position: "absolute",
                left: row.worldX,
                top: row.worldY + i * 76,
                width: 240,
                pointerEvents: "auto",
              }}
            >
              <SlackEmbed thread={t} />
            </div>
          )),
        )}
      </div>
      {resolved.unpinned.length > 0 && <UnpinnedSlackStack threads={resolved.unpinned} />}
    </>
  );
}

// Small floating stack for threads that didn't resolve to any file. Keeps
// them discoverable without cluttering world space. Collapsible to a
// single badge so they stay out of the way on a busy canvas.
function UnpinnedSlackStack({ threads }: { threads: readonly SlackThread[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom: 54,
        zIndex: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        maxWidth: 260,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          alignSelf: "flex-start",
          background: "rgba(15, 23, 42, 0.92)",
          border: "1px solid rgba(148, 163, 184, 0.3)",
          color: "#cbd5e1",
          fontSize: 11,
          padding: "4px 8px",
          borderRadius: 12,
          cursor: "pointer",
        }}
        title="Slack threads without a resolved file link"
      >
        #{open ? "—" : "+"} slack · {threads.length} unlinked
      </button>
      {open && threads.map(t => (
        <div key={t.id} style={{ width: 240 }}>
          <SlackEmbed thread={t} />
        </div>
      ))}
    </div>
  );
}
