import { useEffect, useState } from "react";
import { useBubbleDrag } from "../model/useBubbleDrag";
import { smartPos } from "../lib/smartPos";
import type { Vec2 } from "../lib/findSafeBubblePos";
import { RobotFace } from "./RobotFace";

const INIT_W   = 660;
const INIT_H   = 560;
const APPEAR_DELAY = 300; // ms — 플로팅 전환 후 등장 지연

interface BubbleIconProps {
  initialPos: Vec2;
  /** 팝업이 닫힌 클릭 위치 — Dead Zone 회피 기준점 */
  clickOrigin?: Vec2;
  /** minimizeAt.vel — 최소화 시점 마우스 이동 방향 벡터 */
  mouseVel?: Vec2;
  onExpand: (pos: Vec2) => void;
  onMove?: (pos: Vec2) => void;
}

export function BubbleIcon({ initialPos, clickOrigin, mouseVel, onExpand, onMove: onMoveProp }: BubbleIconProps) {
  // 300ms 뒤 등장 전까지 숨김
  const [visible, setVisible] = useState(false);

  const { anchorPos, ghostPos, sliding, eyeOffset, isDrag, bubbleRef, onMouseDown, setAnchorPos, setSliding } =
    useBubbleDrag(
      initialPos,
      (pos) => { onExpand(smartPos(pos.x, pos.y, INIT_W, INIT_H)); },
      onMoveProp,
    );

  // 마운트 후 300ms: 마지막 마우스 위치 기준 반대 방향으로 안착 후 등장
  useEffect(() => {
    // 마우스 위치 추적 (최대 300ms 동안)
    const samples: Vec2[] = [];
    const onMouseMove = (e: MouseEvent) => {
      samples.push({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", onMouseMove);

    const timer = setTimeout(() => {
      window.removeEventListener("mousemove", onMouseMove);

      // 마우스 방향: prop으로 받은 vel 또는 300ms 동안 수집한 샘플로 계산
      let vel: Vec2;
      if (mouseVel && (mouseVel.x !== 0 || mouseVel.y !== 0)) {
        vel = mouseVel;
      } else if (samples.length >= 2) {
        const first = samples[0];
        const last  = samples[samples.length - 1];
        vel = { x: last.x - first.x, y: last.y - first.y };
      } else {
        // 샘플 없으면 마지막 마우스 위치만으로 중앙 기준 반대 방향 추정
        const m = samples.length > 0 ? samples[0] : (clickOrigin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 });
        vel = { x: m.x - window.innerWidth / 2, y: m.y - window.innerHeight / 2 };
      }

      // 마지막 마우스 위치
      const lastMouse = samples.length > 0 ? samples[samples.length - 1] : (clickOrigin ?? initialPos);

      // 마우스 방향 정규화 후 반대로 80px 오프셋
      const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2) || 1;
      const nx = vel.x / speed;
      const ny = vel.y / speed;
      const OFFSET = 80;
      const bub = 48;
      const pad = 16;
      const raw: Vec2 = {
        x: lastMouse.x - nx * OFFSET,
        y: lastMouse.y - ny * OFFSET,
      };
      const safe: Vec2 = {
        x: Math.min(Math.max(raw.x, pad), window.innerWidth  - bub - pad),
        y: Math.min(Math.max(raw.y, pad), window.innerHeight - bub - pad),
      };

      // 출발 위치(lastMouse 근처)에서 먼저 visible → 다음 프레임에 목적지로 sliding
      setAnchorPos(() => lastMouse);
      setVisible(true);
      requestAnimationFrame(() => {
        setSliding(true);
        setAnchorPos(() => safe);
        onMoveProp?.(safe);
      });
    }, APPEAR_DELAY);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div
        ref={bubbleRef}
        className={`agw-bubble-wrap${isDrag ? " is-dragging" : ""}${sliding ? " is-sliding" : ""}${!visible ? " is-hidden" : ""}`}
        style={{ transform: `translate(${anchorPos.x}px, ${anchorPos.y}px)` }}
        onMouseDown={onMouseDown}
        role="button"
        tabIndex={0}
        aria-label="에이전트 열기"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ")
            {onExpand(smartPos(anchorPos.x, anchorPos.y, INIT_W, INIT_H));}
        }}
      >
        <div className="agw-bubble">
          <RobotFace dragging={isDrag} eyeOffset={eyeOffset} />
        </div>
      </div>

      {isDrag && ghostPos && (
        <div
          className="agw-bubble-ghost"
          style={{ transform: `translate(${ghostPos.x}px, ${ghostPos.y}px)` }}
          aria-hidden="true"
        />
      )}
    </>
  );
}
