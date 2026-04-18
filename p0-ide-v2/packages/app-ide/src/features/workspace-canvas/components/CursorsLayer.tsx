import { useEffect, useMemo, useRef } from "react";
import { useCursorsStore, type CursorSnapshot } from "../store/cursors-store";

interface Props {
  transform: string;
  scale: number;
}

interface RenderedPos {
  x: number;
  y: number;
}

// Smooth cursor interpolation: each cursor has a target (from store) and a
// rendered position held in a ref that lerps ~25% per 16ms frame toward the
// target. Avoids React re-renders during smoothing — we imperatively set the
// DOM transforms instead.
const LERP = 0.25;

export function CursorsLayer({ transform, scale }: Props) {
  const cursors = useCursorsStore(s => s.cursors);
  const layerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const rendered = useRef<Map<string, RenderedPos>>(new Map());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    el.style.transform = transform;
  }, [transform]);

  const targetMap = useMemo(() => {
    const m = new Map<string, CursorSnapshot>();
    for (const c of cursors) m.set(c.userId, c);
    return m;
  }, [cursors]);

  useEffect(() => {
    const tick = () => {
      for (const [id, target] of targetMap.entries()) {
        const node = nodeRefs.current.get(id);
        if (!node) continue;
        let pos = rendered.current.get(id);
        if (!pos) {
          pos = { x: target.worldX, y: target.worldY };
          rendered.current.set(id, pos);
        } else {
          pos.x += (target.worldX - pos.x) * LERP;
          pos.y += (target.worldY - pos.y) * LERP;
        }
        node.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [targetMap]);

  const invScale = scale > 0 ? 1 / scale : 1;

  return (
    <div
      ref={layerRef}
      className="workspace-canvas__cursors-layer"
      style={{ transformOrigin: "0 0" }}
    >
      {cursors.map(c => (
        <div
          key={c.userId}
          ref={el => { nodeRefs.current.set(c.userId, el); }}
          className="ws-cursor"
          style={{ "--cursor-inv-scale": invScale.toFixed(4) } as React.CSSProperties}
        >
          <svg
            className="ws-cursor__pointer"
            viewBox="0 0 20 20"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <path
              d="M2 2 L18 9 L10 11 L8 18 Z"
              fill={c.color}
              stroke="#ffffff"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
          <div className="ws-cursor__tag" style={{ background: c.color }}>
            <span className="ws-cursor__tag-dot" />
            <span className="ws-cursor__tag-name">{c.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
