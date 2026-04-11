interface RobotFaceProps {
  dragging: boolean;
  eyeOffset?: { x: number; y: number };
}

export function RobotFace({ dragging, eyeOffset }: RobotFaceProps) {
  const ox = eyeOffset?.x ?? 0;
  const oy = eyeOffset?.y ?? 0;

  return (
    <svg
      className={`agw-robot-svg${dragging ? " is-surprised" : ""}`}
      width="22" height="22" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round"
    >
      {/* body */}
      <rect x="3" y="8" width="18" height="12" rx="3" />

      {/* 눈: 평소 작은 사각형 → 드래그 중 동그랗게 커짐. 항상 시선 추적 */}
      {dragging ? (
        <>
          <g style={{ transform: `translate(${ox}px, ${oy}px)` }}>
            <circle cx="9.25"  cy="12.5" r="2" fill="currentColor" stroke="none" />
            <circle cx="10"    cy="11.8" r="0.5" fill="white" stroke="none" />
          </g>
          <g style={{ transform: `translate(${ox}px, ${oy}px)` }}>
            <circle cx="14.75" cy="12.5" r="2" fill="currentColor" stroke="none" />
            <circle cx="15.5"  cy="11.8" r="0.5" fill="white" stroke="none" />
          </g>
        </>
      ) : (
        <>
          <g style={{ transform: `translate(${ox}px, ${oy}px)` }}>
            <rect x="8"    y="11" width="2.5" height="2.5" rx="0.6" fill="currentColor" stroke="none" />
          </g>
          <g style={{ transform: `translate(${ox}px, ${oy}px)` }}>
            <rect x="13.5" y="11" width="2.5" height="2.5" rx="0.6" fill="currentColor" stroke="none" />
          </g>
        </>
      )}

      {/* 입: 평소 가로 라인 → 드래그 중 O 모양 */}
      {dragging ? (
        <ellipse cx="12" cy="17.5" rx="2.2" ry="1.6" stroke="currentColor" fill="none" strokeWidth="1.4" />
      ) : (
        <line x1="9.5" y1="17" x2="14.5" y2="17" strokeWidth="1.8" />
      )}

      {/* 안테나 */}
      <line x1="12" y1="8" x2="12" y2="5" />
      <circle cx="12" cy="3.8" r="1.2" fill="currentColor" stroke="none" />

      {/* 팔 */}
      <line x1="3"  y1="13" x2="1.2"  y2="13" strokeWidth="2" />
      <line x1="21" y1="13" x2="22.8" y2="13" strokeWidth="2" />
    </svg>
  );
}
