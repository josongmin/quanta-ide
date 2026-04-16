export function BlastChart() {
  const cols = [24, 88, 152, 216];
  const tier1 = [12, 22, 30];
  const tier2 = [6, 14, 22, 28, 34];
  const tier3 = [8, 18, 26, 32];
  const lines: [number, number, number, number][] = [];
  for (const y of tier1) lines.push([cols[0], 20, cols[1], y]);
  for (let i = 0; i < tier1.length; i++) {
    lines.push([cols[1], tier1[i], cols[2], tier2[i]]);
    lines.push([cols[1], tier1[i], cols[2], tier2[i + 1]]);
  }
  for (let i = 0; i < tier2.length; i++) {
    if (tier3[i] !== undefined) lines.push([cols[2], tier2[i], cols[3], tier3[i]]);
  }
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="xMidYMid meet">
      {lines.map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="0.9"
        />
      ))}
      <circle cx={cols[0]} cy={20} r="3.4" fill="currentColor" />
      {tier1.map((y, i) => <circle key={`a${i}`} cx={cols[1]} cy={y} r="1.8" fill="currentColor" />)}
      {tier2.map((y, i) => <circle key={`b${i}`} cx={cols[2]} cy={y} r="1.8" fill="currentColor" />)}
      {tier3.map((y, i) => <circle key={`c${i}`} cx={cols[3]} cy={y} r="1.8" fill="currentColor" />)}
    </svg>
  );
}

export function RiskChart() {
  const pts = [0.12, 0.18, 0.22, 0.19, 0.28, 0.34, 0.4, 0.46, 0.54, 0.58, 0.68, 0.72];
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * 240) / (pts.length - 1)} ${40 - p * 40}`)
    .join(" ");
  const thresholdY = 40 - 0.6 * 40;
  const lastX = 240;
  const lastY = 40 - pts[pts.length - 1] * 40;
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="none">
      <path d={`${d} L 240 40 L 0 40 Z`} fill="currentColor" fillOpacity="0.15" />
      <line
        x1="0"
        y1={thresholdY}
        x2="240"
        y2={thresholdY}
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="0.7"
        strokeDasharray="2 2"
      />
      <path d={d} stroke="currentColor" fill="none" strokeWidth="1.4" />
      <circle cx={lastX} cy={lastY} r="2.4" fill="currentColor" />
    </svg>
  );
}

export function CovChart() {
  const heights = [24, 28, 26, 30, 28, 32, 30, 28, 22, 20, 18, 16];
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="none">
      {heights.map((h, i) => (
        <rect key={i} x={i * 20 + 4} y={40 - h} width="14" height={h} fill="currentColor" fillOpacity="0.7" />
      ))}
    </svg>
  );
}

export function ComplexChart() {
  const pts = [32, 30, 28, 22, 18, 14, 10];
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * 240) / (pts.length - 1)} ${p}`)
    .join(" ");
  const budgetY = 17;
  const lastX = ((pts.length - 1) * 240) / (pts.length - 1);
  const lastY = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="xMidYMid meet">
      <line
        x1="0"
        y1={budgetY}
        x2="240"
        y2={budgetY}
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="0.7"
        strokeDasharray="2 2"
      />
      <path d={d} stroke="currentColor" fill="none" strokeWidth="1.4" />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={(i * 240) / (pts.length - 1)}
          cy={p}
          r={i === pts.length - 1 ? 2.4 : 1.6}
          fill="currentColor"
        />
      ))}
      <circle cx={lastX} cy={lastY} r="4" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
    </svg>
  );
}

export function TestRateChart() {
  const heights = [26, 28, 27, 29, 28, 30, 14, 29, 28, 27, 29, 17];
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="none">
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 20 + 4}
          y={40 - h}
          width="14"
          height={h}
          fill="currentColor"
          fillOpacity={h < 20 ? 0.35 : 0.7}
        />
      ))}
    </svg>
  );
}

export function LatencyChart() {
  const pts = [22, 20, 24, 22, 26, 23, 21, 25, 24, 22, 26, 24];
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * 240) / (pts.length - 1)} ${40 - p}`)
    .join(" ");
  const budgetY = 6;
  const lastX = 240;
  const lastY = 40 - pts[pts.length - 1];
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="xMidYMid meet">
      <line
        x1="0"
        y1={budgetY}
        x2="240"
        y2={budgetY}
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="0.7"
        strokeDasharray="2 2"
      />
      <path d={`${d} L 240 40 L 0 40 Z`} fill="currentColor" fillOpacity="0.12" />
      <path d={d} stroke="currentColor" fill="none" strokeWidth="1.4" />
      <circle cx={lastX} cy={lastY} r="2.4" fill="currentColor" />
    </svg>
  );
}
