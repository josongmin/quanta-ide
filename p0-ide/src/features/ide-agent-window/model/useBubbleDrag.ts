import { useEffect, useRef, useState } from "react";

export interface Vec2 { x: number; y: number }

/** 마우스 위치 기준으로 버블 중심에서의 방향 각도를 SVG 오프셋으로 변환 */
function calcEyeOffset(mouseX: number, mouseY: number, bubbleEl: HTMLElement): Vec2 {
  const rect = bubbleEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const angle = Math.atan2(mouseY - cy, mouseX - cx);
  const MAX = 1.2; // SVG 단위 최대 이동량
  return { x: Math.cos(angle) * MAX, y: Math.sin(angle) * MAX };
}

export function useBubbleDrag(
  initialPos: Vec2,
  onExpand: (pos: Vec2) => void,
  onMove?: (pos: Vec2) => void,
) {
  const [anchorPos, setAnchorPos] = useState(initialPos);
  const [ghostPos, setGhostPos] = useState<Vec2 | null>(null);
  const [sliding, setSliding] = useState(false);
  const [eyeOffset, setEyeOffset] = useState<Vec2>({ x: 0, y: 0 });

  const isDragging = useRef(false);
  const moved = useRef(false);
  const origin = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const bubbleRef = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    setSliding(false);
    isDragging.current = true;
    moved.current = false;
    origin.current = { mx: e.clientX, my: e.clientY, px: anchorPos.x, py: anchorPos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const dx = e.clientX - origin.current.mx;
        const dy = e.clientY - origin.current.my;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
        setGhostPos({ x: origin.current.px + dx, y: origin.current.py + dy });
      }
      if (bubbleRef.current) {
        setEyeOffset(calcEyeOffset(e.clientX, e.clientY, bubbleRef.current));
      }
    };

    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (!moved.current) {
        setGhostPos(null);
        onExpand(anchorPos);
      } else {
        setGhostPos((prev) => {
          if (prev) {
            setSliding(true);
            setAnchorPos(prev);
            onMove?.(prev);
          }
          return null;
        });
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [anchorPos, onExpand, onMove]);

  const isDrag = ghostPos !== null;

  return { anchorPos, ghostPos, sliding, eyeOffset, isDrag, bubbleRef, onMouseDown, setAnchorPos, setSliding };
}
