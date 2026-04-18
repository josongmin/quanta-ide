import { useEffect, useMemo, useRef } from "react";
import type { LodLevel } from "@quanta/canvas-engine";
import { useFeature } from "../store/feature-flags-store";
import { useSceneStore } from "../store/scene-store";
import { useInteractionStore } from "../store/interaction-store";
import { ticketLinksStore, useTicketLinksStore } from "../store/ticket-links-store";
import { TicketCard } from "./TicketCard";

interface Props {
  transform: string;
}

// LOD visibility: hide at galaxy-scale (too zoomed-out to read), show
// at city / street / ground.
const VISIBLE_LODS: readonly LodLevel[] = ["city", "street", "ground"] as const;

function isVisibleLod(lod: LodLevel): boolean {
  return VISIBLE_LODS.includes(lod);
}

/**
 * World-transformed DOM layer that pins TicketCard instances to the
 * right edge of each file they link to. Seeded from the mock fixture
 * on first mount using the graph's file ids.
 */
export function TicketsLayer({ transform }: Props) {
  const enabled = useFeature("embeds.tickets");
  const lod = useInteractionStore(s => s.lod);
  const layout = useSceneStore(s => s.layout);
  const visible = useSceneStore(s => s.visibleScene);
  const graph = useSceneStore(s => s.graph);
  const byFile = useTicketLinksStore(s => s.byFile);

  const layerRef = useRef<HTMLDivElement>(null);

  // Mirror viewport transform imperatively (same pattern as stickies).
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    el.style.transform = transform;
  }, [transform]);

  // One-shot seed of the link map when the graph arrives.
  useEffect(() => {
    if (!enabled) return;
    if (!graph) return;
    const current = ticketLinksStore.getState().byFile;
    if (current.size > 0) return;
    const fileIds = graph.files.map(f => f.id);
    if (fileIds.length === 0) return;
    ticketLinksStore.seedFromFileIds(fileIds);
  }, [enabled, graph]);

  const renderable = useMemo(() => {
    if (!enabled) return [];
    if (!isVisibleLod(lod)) return [];
    if (!layout || !visible) return [];
    const out: Array<{
      fileId: string;
      worldX: number;
      worldY: number;
      tickets: readonly { id: string; externalId: string; source: "linear" | "jira" | "github"; title: string; state: "todo" | "in-progress" | "in-review" | "done"; url: string; assignee?: string }[];
    }> = [];
    for (const file of visible.files) {
      const rect = layout.fileRects.get(file.id);
      if (!rect) continue;
      const tickets = ticketLinksStore.listFor(file.id);
      if (tickets.length === 0) continue;
      out.push({
        fileId: file.id,
        worldX: rect.x + rect.w + 18,
        worldY: rect.y,
        tickets,
      });
    }
    return out;
  }, [enabled, lod, layout, visible, byFile]);

  if (!enabled || !isVisibleLod(lod)) return null;

  return (
    <div
      ref={layerRef}
      className="workspace-canvas__tickets-layer"
      style={{ transformOrigin: "0 0" }}
    >
      {renderable.flatMap(row =>
        row.tickets.map((t, i) => (
          <TicketCard
            key={`${row.fileId}:${t.id}`}
            ticket={t}
            worldX={row.worldX}
            worldY={row.worldY}
            stackIndex={i}
          />
        )),
      )}
    </div>
  );
}
