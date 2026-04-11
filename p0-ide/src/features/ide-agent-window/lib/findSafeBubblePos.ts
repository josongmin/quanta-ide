/**
 * findSafeBubblePos — Dead Zone 회피 버블 안착 위치 탐색
 *
 * 화면을 격자로 나눠 각 셀의 "방해도 점수"를 계산하고
 * 점수가 가장 낮은 셀로 버블을 이동시킨다.
 *
 * 방해도 점수 구성:
 *   1. 클릭 위치 근접도   — 팝업이 있던 곳 근처는 위험
 *   2. 마우스 동선 전방   — 마우스가 향하는 방향 앞쪽은 위험
 *   3. 화면 중앙 근접도   — 중앙일수록 시야 방해
 *   4. 현재 버블 위치      — 너무 멀리 보내지 않도록 거리 패널티
 */

export interface Vec2 { x: number; y: number }

interface FindSafePosOptions {
  clickPos: Vec2;          // 팝업 닫힌 클릭 위치
  mouseVel: Vec2;          // 마우스 이동 방향 벡터 (정규화 전)
  currentPos: Vec2;        // 현재 버블 위치
  bubbleSize?: number;     // 버블 크기 (default 48)
  pad?: number;            // 화면 여백 (default 20)
  gridCols?: number;       // 격자 열 수 (default 12)
  gridRows?: number;       // 격자 행 수 (default 8)
}

export function findSafeBubblePos({
  clickPos,
  mouseVel,
  currentPos,
  bubbleSize = 48,
  pad = 20,
  gridCols = 12,
  gridRows = 8,
}: FindSafePosOptions): Vec2 {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 유효 영역
  const minX = pad;
  const minY = pad;
  const maxX = vw - bubbleSize - pad;
  const maxY = vh - bubbleSize - pad;

  const cellW = (maxX - minX) / gridCols;
  const cellH = (maxY - minY) / gridRows;

  // 마우스 속도 정규화
  const speed = Math.sqrt(mouseVel.x ** 2 + mouseVel.y ** 2) || 1;
  const velNorm = { x: mouseVel.x / speed, y: mouseVel.y / speed };

  let bestScore = Infinity;
  let bestPos: Vec2 = currentPos;

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const cx = minX + col * cellW + cellW / 2;
      const cy = minY + row * cellH + cellH / 2;

      // ── 1. 클릭 위치 근접도 (가까울수록 위험) ──────────────────
      const dClick = Math.sqrt((cx - clickPos.x) ** 2 + (cy - clickPos.y) ** 2);
      const clickScore = Math.max(0, 1 - dClick / 400) * 100;

      // ── 2. 마우스 동선 전방 위험도 ─────────────────────────────
      // 마우스 현재 위치(=클릭 위치)에서 셀까지의 벡터를 이동 방향에 투영
      const toCellX = cx - clickPos.x;
      const toCellY = cy - clickPos.y;
      // 투영값 > 0 이면 마우스가 향하는 쪽, 클수록 더 앞쪽
      const projection = toCellX * velNorm.x + toCellY * velNorm.y;
      const lateralDist = Math.abs(toCellX * (-velNorm.y) + toCellY * velNorm.x);
      // 동선 앞쪽 + 경로 가까울수록 위험
      const pathScore = projection > 0
        ? Math.max(0, 1 - lateralDist / 200) * Math.min(projection / 300, 1) * 80
        : 0;

      // ── 3. 화면 중앙 근접도 (중앙일수록 시야 방해) ─────────────
      const dCenter = Math.sqrt((cx - vw / 2) ** 2 + (cy - vh / 2) ** 2);
      const maxDCenter = Math.sqrt((vw / 2) ** 2 + (vh / 2) ** 2);
      const centerScore = Math.max(0, 1 - dCenter / maxDCenter) * 40;

      // ── 4. 현재 버블 위치에서 이동 거리 패널티 (너무 멀리 X) ───
      const dCurrent = Math.sqrt((cx - currentPos.x) ** 2 + (cy - currentPos.y) ** 2);
      const distScore = Math.min(dCurrent / 600, 1) * 30;

      const total = clickScore + pathScore + centerScore + distScore;

      if (total < bestScore) {
        bestScore = total;
        bestPos = { x: cx - bubbleSize / 2, y: cy - bubbleSize / 2 };
      }
    }
  }

  // 경계 clamp
  return {
    x: Math.min(Math.max(bestPos.x, minX), maxX),
    y: Math.min(Math.max(bestPos.y, minY), maxY),
  };
}
