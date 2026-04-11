/**
 * smartPos — 버블 위치 기준으로 에이전트 패널이 열릴 최적 좌표 계산
 *
 * 전략:
 *   1. 버블 주변 4방향(우/좌/하/상)의 가용 공간을 측정
 *   2. 패널이 들어갈 수 있는 방향 중 가용 공간이 가장 넓은 쪽 선택
 *   3. 선택된 축의 수직 방향은 버블 중심을 기준으로 가운데 정렬 시도
 *   4. 화면 경계 clamp
 */

const PAD    = 12;
const BUBBLE = 48;
const GAP    = 12;

type Dir = "right" | "left" | "bottom" | "top";

export function smartPos(
  bx: number,
  by: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 버블 중심
  const bcx = bx + BUBBLE / 2;
  const bcy = by + BUBBLE / 2;

  // 각 방향의 가용 공간 (패널이 들어갈 수 있는 px)
  const space: Record<Dir, number> = {
    right:  vw - (bx + BUBBLE + GAP) - PAD,
    left:   bx - GAP - PAD,
    bottom: vh - (by + BUBBLE + GAP) - PAD,
    top:    by - GAP - PAD,
  };

  // 패널이 실제로 들어갈 수 있는 방향만 필터 (최소 크기 보장)
  const MIN_W = 320;
  const MIN_H = 240;
  const viable = (Object.entries(space) as [Dir, number][]).filter(([dir, s]) =>
    (dir === "right" || dir === "left") ? s >= MIN_W && h <= vh - PAD * 2
                                        : s >= MIN_H && w <= vw - PAD * 2
  );

  // 가용 공간 내림차순 정렬 → 가장 넓은 방향 선택
  const [bestDir] = viable.sort(([, a], [, b]) => b - a)[0]
    ?? (["right", space.right] as [Dir, number]);

  let x: number, y: number;

  if (bestDir === "right") {
    x = bx + BUBBLE + GAP;
    y = clamp(bcy - h / 2, PAD, vh - h - PAD);
  } else if (bestDir === "left") {
    x = bx - GAP - w;
    y = clamp(bcy - h / 2, PAD, vh - h - PAD);
  } else if (bestDir === "bottom") {
    x = clamp(bcx - w / 2, PAD, vw - w - PAD);
    y = by + BUBBLE + GAP;
  } else {
    // top
    x = clamp(bcx - w / 2, PAD, vw - w - PAD);
    y = by - GAP - h;
  }

  return {
    x: clamp(x, PAD, vw - w - PAD),
    y: clamp(y, PAD, vh - h - PAD),
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}
