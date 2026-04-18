import type { ReactElement } from "react";
import { RefreshCw, Home, Compass, AlertTriangle } from "lucide-react";
import { useDemoNav } from "../../DemoPage";

const P = {
  sky1: "#bfe9f5",
  sky2: "#d1eff5",
  sky3: "#e7f6f7",
  mntFar: "#b6c2d1",
  mntNear: "#8894a8",
  mntShade: "#6f7c91",
  snow: "#f0f3f7",
  forestDark: "#2a6a2f",
  forestMid: "#3c7b3f",
  forestLite: "#6fae5f",
  grass: "#7cc26a",
  grassShade: "#5aa352",
  grassDark: "#3a7a34",
  dirt: "#8a5a28",
  dirtLite: "#a9742e",
  dirtDark: "#5c3a18",
  trunk: "#5a3a20",
  trunkLite: "#7a5230",
  cloud: "#ffffff",
  sun: "#fde68a",
  pig: "#f2b1c2",
  pigDark: "#d88ba1",
  pigEye: "#2a1a1a",
  hen: "#ffffff",
  comb: "#e35464",
  beak: "#f4a83b",
  flower1: "#f4d742",
  flower2: "#f097c0",
  flower3: "#e85b5b",
  flower4: "#c281e0",
  rainbowA: "#e85b5b",
  rainbowB: "#f5a65a",
  rainbowC: "#f7d65a",
  rainbowD: "#7ad166",
  rainbowE: "#6aa9e0",
  rainbowF: "#9678c9",
};

type Palette = Record<string, string>;

interface SpriteProps {
  x: number;
  y: number;
  rows: string[];
  palette: Palette;
  px?: number;
}

function Sprite({ x, y, rows, palette, px = 1 }: SpriteProps) {
  const out: ReactElement[] = [];
  for (let r = 0; r < rows.length; r++) {
    let c = 0;
    while (c < rows[r].length) {
      const ch = rows[r][c];
      if (ch === "." || ch === " ") {
        c++;
        continue;
      }
      let c2 = c;
      while (c2 < rows[r].length && rows[r][c2] === ch) c2++;
      out.push(
        <rect
          key={`${r}-${c}`}
          x={x + c * px}
          y={y + r * px}
          width={(c2 - c) * px}
          height={px}
          fill={palette[ch]}
        />,
      );
      c = c2;
    }
  }
  return <>{out}</>;
}

const PIG_ROWS = [
  "..PPPP..",
  ".PPPPPP.",
  "PDPPPPDP",
  "PPPEPPEP",
  "PPNNNNPP",
  "PPPPPPPP",
  "P.PP.PP.",
];
const PIG_PAL: Palette = { P: P.pig, D: P.pigDark, E: P.pigEye, N: P.pigDark };

const HEN_ROWS = [
  ".CC....",
  "CCCC...",
  ".WWWB..",
  "WWWWW..",
  "WWWWW..",
  "WWWWWW.",
  ".Y..Y..",
];
const HEN_PAL: Palette = { C: P.comb, W: P.hen, B: P.beak, Y: P.beak };

const CLOUD_ROWS = [
  "..CCCC...",
  ".CCCCCCC.",
  "CCCCCCCCC",
  ".CCCCCCC.",
];
const CLOUD_PAL: Palette = { C: P.cloud };

const CLOUD_SM_ROWS = [
  "..CCC..",
  ".CCCCC.",
  "CCCCCCC",
  ".CCCCC.",
];

const SUN_ROWS = [
  "..SSSS..",
  ".SSSSSS.",
  "SSSSSSSS",
  "SSSSSSSS",
  "SSSSSSSS",
  "SSSSSSSS",
  ".SSSSSS.",
  "..SSSS..",
];
const SUN_PAL: Palette = { S: P.sun };

const TREE_ROWS = [
  "..GGG..",
  ".GGGGG.",
  "GGGGGGG",
  "GGGGGGG",
  ".GGGGG.",
  "..GGG..",
  "...T...",
  "...T...",
  "..TTT..",
];
const TREE_PAL_DK: Palette = { G: P.forestDark, T: P.trunk };
const TREE_PAL_MD: Palette = { G: P.forestMid, T: P.trunkLite };

const ISLAND_ROWS = [
  "..GGGGGGGGGGGG..",
  ".GGGGGGGGGGGGGG.",
  "DDDDDDDDDDDDDDDD",
  "DDDDDDDDDDDDDDDD",
  "eDDDDDDDDDDDDDDe",
  ".eeDDDDDDDDDDee.",
  "...eeDDDDDDee...",
  ".....eeDDee.....",
  ".......ee.......",
];
const ISLAND_PAL: Palette = { G: P.grass, D: P.dirtLite, e: P.dirt };

const ISLAND_SM_ROWS = [
  ".GGGGGGGG.",
  "DDDDDDDDDD",
  "eDDDDDDDDe",
  ".eeDDDDee.",
  "...eeee...",
];

const FLOWER_ROWS = ["F", "*"];

const FLOWER_PAL = (petal: string): Palette => ({ F: petal, "*": P.grassDark });

const BUSH_ROWS = [
  "..gggg..",
  ".gGGGGg.",
  "gGGGGGGg",
  ".gGGGGg.",
];
const BUSH_PAL: Palette = { G: P.forestMid, g: P.forestDark };

const LOGO_ROWS = [
  "..QQQQ..",
  ".QQ..QQ.",
  "QQ....QQ",
  "QQ..QQQQ",
  "QQ....QQ",
  ".QQ..QQ.",
  "..QQQQQQ",
  ".....QQQ",
];
const LOGO_PAL: Palette = { Q: "#1a1a1a" };

function PixelScene() {
  const trees: Array<{ x: number; y: number; palette: Palette; px: number }> = [
    { x: 6, y: 88, palette: TREE_PAL_DK, px: 2 },
    { x: 32, y: 92, palette: TREE_PAL_MD, px: 2 },
    { x: 58, y: 90, palette: TREE_PAL_DK, px: 2 },
    { x: 248, y: 92, palette: TREE_PAL_MD, px: 2 },
    { x: 278, y: 88, palette: TREE_PAL_DK, px: 2 },
    { x: 302, y: 94, palette: TREE_PAL_MD, px: 2 },
  ];

  const bigTreeLeft = { x: 10, y: 112, palette: TREE_PAL_DK, px: 4 };
  const bigTreeRight = { x: 276, y: 116, palette: TREE_PAL_DK, px: 4 };

  const flowers: Array<{ x: number; y: number; pal: Palette }> = [
    { x: 54, y: 166, pal: FLOWER_PAL(P.flower1) },
    { x: 72, y: 170, pal: FLOWER_PAL(P.flower2) },
    { x: 96, y: 168, pal: FLOWER_PAL(P.flower3) },
    { x: 118, y: 172, pal: FLOWER_PAL(P.flower1) },
    { x: 148, y: 170, pal: FLOWER_PAL(P.flower4) },
    { x: 178, y: 172, pal: FLOWER_PAL(P.flower2) },
    { x: 210, y: 170, pal: FLOWER_PAL(P.flower1) },
    { x: 240, y: 172, pal: FLOWER_PAL(P.flower3) },
    { x: 266, y: 170, pal: FLOWER_PAL(P.flower2) },
    { x: 290, y: 172, pal: FLOWER_PAL(P.flower1) },
  ];

  const bushes: Array<{ x: number; y: number }> = [
    { x: 82, y: 160 },
    { x: 158, y: 162 },
    { x: 254, y: 160 },
  ];

  return (
    <svg
      viewBox="0 0 320 180"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      style={{ display: "block", position: "absolute", inset: 0 }}
      aria-hidden
    >
      {/* sky bands */}
      <rect x="0" y="0" width="320" height="60" fill={P.sky1} />
      <rect x="0" y="60" width="320" height="30" fill={P.sky2} />
      <rect x="0" y="90" width="320" height="20" fill={P.sky3} />

      {/* sun */}
      <Sprite x={252} y={16} rows={SUN_ROWS} palette={SUN_PAL} px={2} />

      {/* clouds */}
      <Sprite x={22} y={18} rows={CLOUD_ROWS} palette={CLOUD_PAL} px={2} />
      <Sprite x={102} y={8} rows={CLOUD_SM_ROWS} palette={CLOUD_PAL} px={2} />
      <Sprite x={180} y={38} rows={CLOUD_SM_ROWS} palette={CLOUD_PAL} px={2} />

      {/* back mountains */}
      <polygon
        points="0,92 28,72 52,86 84,62 112,88 146,70 178,86 208,66 240,84 272,74 300,88 320,80 320,110 0,110"
        fill={P.mntFar}
      />
      {/* front mountains */}
      <polygon
        points="-4,100 24,84 52,96 86,74 110,92 140,82 168,96 196,78 228,94 262,82 296,98 320,92 320,112 -4,112"
        fill={P.mntNear}
      />
      {/* snow caps on front peaks */}
      <polygon points="82,76 86,74 90,76 92,80 80,80" fill={P.snow} />
      <polygon points="192,80 196,78 200,80 202,84 190,84" fill={P.snow} />
      {/* mountain shadow */}
      <polygon
        points="-4,112 24,96 52,108 86,86 110,104 140,94 168,108 196,90 228,106 262,94 296,110 320,104 320,114 -4,114"
        fill={P.mntShade}
        opacity={0.35}
      />

      {/* rainbow: stacked arc strips clipped by a rect */}
      <defs>
        <clipPath id="glitch-rainbow-clip">
          <rect x="70" y="50" width="180" height="80" />
        </clipPath>
      </defs>
      <g clipPath="url(#glitch-rainbow-clip)">
        <circle cx="160" cy="130" r="72" fill="none" stroke={P.rainbowA} strokeWidth="4" />
        <circle cx="160" cy="130" r="68" fill="none" stroke={P.rainbowB} strokeWidth="4" />
        <circle cx="160" cy="130" r="64" fill="none" stroke={P.rainbowC} strokeWidth="4" />
        <circle cx="160" cy="130" r="60" fill="none" stroke={P.rainbowD} strokeWidth="4" />
        <circle cx="160" cy="130" r="56" fill="none" stroke={P.rainbowE} strokeWidth="4" />
        <circle cx="160" cy="130" r="52" fill="none" stroke={P.rainbowF} strokeWidth="4" />
      </g>

      {/* floating islands */}
      <g>
        <Sprite x={200} y={50} rows={ISLAND_ROWS} palette={ISLAND_PAL} px={2} />
        <Sprite x={218} y={44} rows={TREE_ROWS} palette={TREE_PAL_MD} px={2} />
      </g>
      <g>
        <Sprite x={96} y={68} rows={ISLAND_SM_ROWS} palette={ISLAND_PAL} px={2} />
        <Sprite x={102} y={62} rows={TREE_ROWS} palette={TREE_PAL_DK} px={1} />
      </g>

      {/* forest line silhouettes */}
      {trees.map((t, i) => (
        <Sprite key={`bt-${i}`} x={t.x} y={t.y} rows={TREE_ROWS} palette={t.palette} px={t.px} />
      ))}

      {/* ground */}
      <rect x="0" y="132" width="320" height="48" fill={P.grass} />
      <rect x="0" y="130" width="320" height="2" fill={P.grassShade} />
      {/* grass tufts */}
      <g fill={P.grassShade}>
        {Array.from({ length: 40 }).map((_, i) => (
          <rect key={`tuft-${i}`} x={(i * 8 + 3) % 320} y={140 + ((i * 13) % 32)} width={2} height={2} />
        ))}
      </g>
      <g fill={P.grassDark}>
        {Array.from({ length: 30 }).map((_, i) => (
          <rect key={`tuftd-${i}`} x={(i * 11 + 7) % 320} y={150 + ((i * 7) % 24)} width={2} height={2} />
        ))}
      </g>

      {/* big foreground trees */}
      <Sprite {...bigTreeLeft} rows={TREE_ROWS} />
      <Sprite {...bigTreeRight} rows={TREE_ROWS} />

      {/* bushes */}
      {bushes.map((b, i) => (
        <Sprite key={`b-${i}`} x={b.x} y={b.y} rows={BUSH_ROWS} palette={BUSH_PAL} px={2} />
      ))}

      {/* flowers */}
      {flowers.map((f, i) => (
        <Sprite key={`f-${i}`} x={f.x} y={f.y} rows={FLOWER_ROWS} palette={f.pal} px={2} />
      ))}

      {/* pig */}
      <Sprite x={138} y={156} rows={PIG_ROWS} palette={PIG_PAL} px={2} />
      {/* chicken */}
      <Sprite x={196} y={158} rows={HEN_ROWS} palette={HEN_PAL} px={2} />

      {/* tiny Quanta mark stamped bottom-right */}
      <Sprite x={298} y={162} rows={LOGO_ROWS} palette={LOGO_PAL} px={1} />
    </svg>
  );
}

export function GlitchPage() {
  const nav = useDemoNav();
  return (
    <div className="glitch-page">
      <style>{GLITCH_CSS}</style>
      <div className="glitch-scene">
        <PixelScene />
        <div className="glitch-scanlines" aria-hidden />
      </div>

      <div className="glitch-overlay">
        <div className="glitch-card">
          <div className="glitch-card__titlebar">
            <div className="glitch-card__dots">
              <span style={{ background: "#ff5f56" }} />
              <span style={{ background: "#ffbd2e" }} />
              <span style={{ background: "#27c93f" }} />
            </div>
            <div className="glitch-card__bar-text">GLITCH.EXE — not responding</div>
            <div className="glitch-card__bar-x" aria-hidden>×</div>
          </div>

          <div className="glitch-card__body">
            <div className="glitch-card__warn" aria-hidden>
              <AlertTriangle size={22} strokeWidth={2.4} />
            </div>
            <h1
              className="glitch-card__heading"
              data-text="There&rsquo;s been a glitch&hellip;"
            >
              There&rsquo;s been a glitch&hellip;
            </h1>
            <p className="glitch-card__sub">
              We&rsquo;re not quite sure what went wrong. You can go back, or try looking on our help
              center if you need a hand.
            </p>

            <div className="glitch-card__trace">
              <span className="glitch-card__trace-key">TRACE</span>
              <code className="glitch-card__trace-val">0xDEAD_BEEF · packet lost @ 0x7A3F</code>
            </div>

            <div className="glitch-card__actions">
              <button className="glitch-btn glitch-btn--primary" type="button">
                <RefreshCw size={14} strokeWidth={2.2} /> Reload reality
              </button>
              <button
                className="glitch-btn"
                type="button"
                onClick={() => nav.navigate("catalog")}
              >
                <Home size={14} strokeWidth={2.2} /> Back to home
              </button>
              <button
                className="glitch-btn"
                type="button"
                onClick={() => nav.navigate("legal.help")}
              >
                <Compass size={14} strokeWidth={2.2} /> Help center
              </button>
            </div>
          </div>

          <div className="glitch-card__footer">
            <span>ERR</span>
            <span>WRLD_NOT_FOUND</span>
            <span className="glitch-card__footer-sep">·</span>
            <span>retrying segment 0x7A3F…</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const GLITCH_CSS = `
.glitch-page {
  position: relative;
  width: 100%;
  min-height: 100%;
  overflow: hidden;
  background: #bfe9f5;
  image-rendering: pixelated;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
}

.glitch-scene {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.glitch-scanlines {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0) 0px,
    rgba(0, 0, 0, 0) 2px,
    rgba(0, 0, 0, 0.06) 3px,
    rgba(0, 0, 0, 0.06) 4px
  );
  mix-blend-mode: multiply;
  pointer-events: none;
}

.glitch-overlay {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 40px 16px;
}

.glitch-card {
  width: 100%;
  max-width: 520px;
  background: #fafaf7;
  color: #1a1a1a;
  border: 2px solid #111;
  box-shadow:
    4px 0 0 #111,
    0 4px 0 #111,
    4px 4px 0 #111,
    8px 8px 0 rgba(17, 17, 17, 0.25);
  position: relative;
}

.glitch-card::before {
  content: "";
  position: absolute;
  inset: 4px;
  border: 1px dashed rgba(17, 17, 17, 0.18);
  pointer-events: none;
}

.glitch-card__titlebar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: #111;
  color: #f5f5f0;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-bottom: 2px solid #111;
}

.glitch-card__dots {
  display: inline-flex;
  gap: 6px;
}
.glitch-card__dots span {
  width: 10px;
  height: 10px;
  border-radius: 0;
  display: inline-block;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.4);
}

.glitch-card__bar-text {
  text-align: center;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.glitch-card__bar-x {
  font-size: 14px;
  line-height: 1;
  font-weight: 800;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e85b5b;
  color: #f5f5f0;
}

.glitch-card__body {
  padding: 20px 22px 18px;
}

.glitch-card__warn {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #111;
  background: #f7d65a;
  border: 2px solid #111;
  margin-bottom: 14px;
  box-shadow: 3px 3px 0 #111;
}

.glitch-card__heading {
  position: relative;
  margin: 0 0 10px 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.15;
  color: #111;
  font-family: inherit;
}

.glitch-card__heading::before,
.glitch-card__heading::after {
  content: attr(data-text);
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.glitch-card__heading::before {
  color: #e85b5b;
  transform: translate(2px, 0);
  clip-path: polygon(0 0, 100% 0, 100% 42%, 0 42%);
  mix-blend-mode: multiply;
  animation: glitch-shift-a 3.4s infinite steps(1);
}
.glitch-card__heading::after {
  color: #6aa9e0;
  transform: translate(-2px, 0);
  clip-path: polygon(0 58%, 100% 58%, 100% 100%, 0 100%);
  mix-blend-mode: multiply;
  animation: glitch-shift-b 2.9s infinite steps(1);
}

@keyframes glitch-shift-a {
  0%, 92%, 100% { transform: translate(2px, 0); }
  93% { transform: translate(5px, -1px); }
  95% { transform: translate(-3px, 1px); }
  97% { transform: translate(4px, 0); }
}
@keyframes glitch-shift-b {
  0%, 88%, 100% { transform: translate(-2px, 0); }
  89% { transform: translate(-5px, 1px); }
  91% { transform: translate(3px, -1px); }
  93% { transform: translate(-4px, 0); }
}

.glitch-card__sub {
  margin: 0 0 14px 0;
  font-size: 13px;
  line-height: 1.55;
  color: #333;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}

.glitch-card__trace {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: #111;
  color: #7ad166;
  border: 2px solid #111;
  margin-bottom: 16px;
  font-size: 11px;
  letter-spacing: 0.04em;
}
.glitch-card__trace-key {
  color: #f7d65a;
  font-weight: 700;
  letter-spacing: 0.12em;
}
.glitch-card__trace-val {
  font-family: inherit;
  color: #7ad166;
}

.glitch-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.glitch-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #111;
  background: #f5f5f0;
  border: 2px solid #111;
  box-shadow: 3px 3px 0 #111;
  cursor: pointer;
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}
.glitch-btn:hover {
  transform: translate(1px, 1px);
  box-shadow: 2px 2px 0 #111;
}
.glitch-btn:active {
  transform: translate(3px, 3px);
  box-shadow: 0 0 0 #111;
}
.glitch-btn--primary {
  background: #111;
  color: #f7d65a;
}
.glitch-btn--primary:hover {
  background: #1a1a1a;
}

.glitch-card__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-top: 2px solid #111;
  background: #f2f1ea;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #555;
}
.glitch-card__footer-sep { color: #999; }
.glitch-card__footer span:nth-child(1) {
  font-weight: 800;
  color: #e85b5b;
}
`;
