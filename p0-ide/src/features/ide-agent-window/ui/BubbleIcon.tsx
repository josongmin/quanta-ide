import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  // 300ms 뒤 등장 전까지 숨김
  const [visible, setVisible] = useState(false);
  const [vanishing, setVanishing] = useState(false);

  const handleExpand = (pos: { x: number; y: number }) => {
    // 슉 사라지는 애니메이션 후 expand
    setVanishing(true);
    setTimeout(() => {
      onExpand(smartPos(pos.x, pos.y, INIT_W, INIT_H));
    }, 180); // agw-bubble-vanish 0.2s보다 살짝 짧게
  };

  const { anchorPos, ghostPos, sliding, eyeOffset, isDrag, bubbleRef, onMouseDown, setAnchorPos, setSliding } =
    useBubbleDrag(
      initialPos,
      handleExpand,
      onMoveProp,
    );

  // 등장 로직: clickOrigin이 있으면(outside click에서 온 경우) 즉시 해당 위치에 등장.
  // 없으면 기존처럼 300ms 딜레이 후 마우스 반대 방향으로 등장.
  useEffect(() => {
    const bub = 48;
    const pad = 16;

    const clampToViewport = (pos: Vec2): Vec2 => ({
      x: Math.min(Math.max(pos.x, pad), window.innerWidth  - bub - pad),
      y: Math.min(Math.max(pos.y, pad), window.innerHeight - bub - pad),
    });

    // outside click에서 왔을 때: 클릭 위치에 즉시 등장
    if (clickOrigin) {
      const origin: Vec2 = { x: clickOrigin.x - bub / 2, y: clickOrigin.y - bub / 2 };
      const safe = clampToViewport(origin);
      requestAnimationFrame(() => {
        setAnchorPos(() => safe);
        setVisible(true);
        onMoveProp?.(safe);
      });
      return;
    }

    // 일반 경우(idle bubble): 300ms 뒤 마우스 반대 방향으로 등장
    const samples: Vec2[] = [];
    const onMouseMove = (e: MouseEvent) => {
      samples.push({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", onMouseMove);

    const timer = setTimeout(() => {
      window.removeEventListener("mousemove", onMouseMove);

      let vel: Vec2;
      if (mouseVel && (mouseVel.x !== 0 || mouseVel.y !== 0)) {
        vel = mouseVel;
      } else if (samples.length >= 2) {
        const first = samples[0];
        const last  = samples[samples.length - 1];
        vel = { x: last.x - first.x, y: last.y - first.y };
      } else {
        const m = samples.length > 0 ? samples[0] : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        vel = { x: m.x - window.innerWidth / 2, y: m.y - window.innerHeight / 2 };
      }

      const lastMouse = samples.length > 0 ? samples[samples.length - 1] : initialPos;

      const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2) || 1;
      const nx = vel.x / speed;
      const ny = vel.y / speed;
      const OFFSET = 40;
      const raw: Vec2 = {
        x: lastMouse.x - nx * OFFSET,
        y: lastMouse.y - ny * OFFSET,
      };
      const safe = clampToViewport(raw);

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
        className={`agw-bubble-wrap${isDrag ? " is-dragging" : ""}${sliding ? " is-sliding" : ""}${!visible ? " is-hidden" : ""}${vanishing ? " is-vanishing" : ""}`}
        style={{ transform: `translate(${anchorPos.x}px, ${anchorPos.y}px)` }}
        onMouseDown={onMouseDown}
        role="button"
        tabIndex={0}
        aria-label={t("ide.agent.openAgent")}
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
