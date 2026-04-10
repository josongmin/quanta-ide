export interface Vec2 { x: number; y: number }

const BUBBLE = 48;
const PAD    = 20;
const MAX_NUDGE = 200; // px

/**
 * smartBubblePos — 마우스 이동 방향 반대로 튕겨나는 안착 위치
 *
 * speed에 비례해 최대 200px까지 반대 방향으로 밀어냄.
 * 속도가 거의 없으면 클릭 위치 근처 그대로.
 */
export function smartBubblePos(mouseX: number, mouseY: number, vel: Vec2): Vec2 {
  const vw    = window.innerWidth;
  const vh    = window.innerHeight;
  const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

  let nx = 0;
  let ny = 0;

  if (speed > 0.02) {
    const nudge = Math.min(speed * 60, MAX_NUDGE);
    nx = -(vel.x / speed) * nudge;
    ny = -(vel.y / speed) * nudge;
  }

  const x = Math.min(Math.max(mouseX - BUBBLE / 2 + nx, PAD), vw - BUBBLE - PAD);
  const y = Math.min(Math.max(mouseY - BUBBLE / 2 + ny, PAD), vh - BUBBLE - PAD);

  return { x, y };
}
