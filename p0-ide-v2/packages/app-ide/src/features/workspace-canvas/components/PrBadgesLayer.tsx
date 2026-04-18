import { useEffect, useMemo, useRef } from "react";
import type { LodLevel } from "@quanta/canvas-engine";
import { useFeature } from "../store/feature-flags-store";
import { useSceneStore } from "../store/scene-store";
import { useInteractionStore } from "../store/interaction-store";
import { buildPrsByFile, type PR } from "../lib/mock-prs";
import { PrBadge } from "./PrBadge";

interface Props {
  transform: string;
}

const VISIBLE_LODS: readonly LodLevel[] = ["city", "street", "ground"] as const;

function isVisibleLod(lod: LodLevel): boolean {
  return VISIBLE_LODS.includes(lod);
}

/**
 * World-transformed DOM layer that pins PR pills to the top-left of
 * each file card that is touched by a mock PR. Resolution of `file →
 * PR[]` happens once when the graph arrives and is cached in a memo.
 */
export function PrBadgesLayer({ transform }: Props) {
  const enabled = useFeature("embeds.prBadge");
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

  const prsByFile = useMemo<ReadonlyMap<string, readonly PR[]>>(() => {
    if (!graph) return new Map();
    return buildPrsByFile(graph.files.map(f => f.id));
  }, [graph]);

  const renderable = useMemo(() => {
    if (!enabled) return [];
    if (!isVisibleLod(lod)) return [];
    if (!layout || !visible) return [];
    const out: Array<{ fileId: string; worldX: number; worldY: number; prs: readonly PR[] }> = [];
    for (const file of visible.files) {
      const rect = layout.fileRects.get(file.id);
      if (!rect) continue;
      const prs = prsByFile.get(file.id);
      if (!prs || prs.length === 0) continue;
      out.push({
        fileId: file.id,
        worldX: rect.x - 6,
        worldY: rect.y - 22,
        prs,
      });
    }
    return out;
  }, [enabled, lod, layout, visible, prsByFile]);

  if (!enabled || !isVisibleLod(lod)) return null;

  return (
    <div
      ref={layerRef}
      className="workspace-canvas__pr-badges-layer"
      style={{ transformOrigin: "0 0" }}
    >
      {renderable.flatMap(row =>
        row.prs.map((pr, i) => (
          <PrBadge
            key={`${row.fileId}:${pr.number}`}
            pr={pr}
            worldX={row.worldX}
            worldY={row.worldY}
            stackIndex={i}
          />
        )),
      )}
    </div>
  );
}
