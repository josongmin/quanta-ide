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

function SkyScene() {
  const forestLine: Array<{ x: number; y: number; palette: Palette; px: number }> = [
    { x: 4, y: 82, palette: TREE_PAL_DK, px: 1 },
    { x: 14, y: 84, palette: TREE_PAL_MD, px: 1 },
    { x: 26, y: 82, palette: TREE_PAL_DK, px: 1 },
    { x: 44, y: 84, palette: TREE_PAL_MD, px: 1 },
    { x: 116, y: 82, palette: TREE_PAL_MD, px: 1 },
    { x: 132, y: 84, palette: TREE_PAL_DK, px: 1 },
    { x: 186, y: 84, palette: TREE_PAL_DK, px: 1 },
    { x: 196, y: 82, palette: TREE_PAL_MD, px: 1 },
    { x: 252, y: 82, palette: TREE_PAL_MD, px: 1 },
    { x: 264, y: 84, palette: TREE_PAL_DK, px: 1 },
    { x: 292, y: 82, palette: TREE_PAL_DK, px: 1 },
    { x: 304, y: 84, palette: TREE_PAL_MD, px: 1 },
  ];

  return (
    <svg
      viewBox="0 0 320 100"
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      className="glitch-svg"
      aria-hidden
    >
      {/* sun */}
      <Sprite x={268} y={8} rows={SUN_ROWS} palette={SUN_PAL} px={2} />

      {/* clouds */}
      <Sprite x={24} y={10} rows={CLOUD_ROWS} palette={CLOUD_PAL} px={2} />
      <Sprite x={102} y={2} rows={CLOUD_SM_ROWS} palette={CLOUD_PAL} px={2} />
      <Sprite x={196} y={22} rows={CLOUD_SM_ROWS} palette={CLOUD_PAL} px={2} />
      <Sprite x={150} y={34} rows={CLOUD_SM_ROWS} palette={CLOUD_PAL} px={1} />

      {/* back mountains */}
      <polygon
        points="0,60 28,40 52,54 84,28 112,56 146,36 178,54 208,32 240,52 272,40 300,56 320,46 320,100 0,100"
        fill={P.mntFar}
      />
      {/* front mountains */}
      <polygon
        points="-4,70 24,52 52,66 86,40 110,62 140,50 168,66 196,44 228,64 262,50 296,68 320,60 320,100 -4,100"
        fill={P.mntNear}
      />
      {/* snow caps */}
      <polygon points="82,44 86,40 90,44 92,48 80,48" fill={P.snow} />
      <polygon points="192,48 196,44 200,48 202,52 190,52" fill={P.snow} />
      {/* mountain shadow */}
      <polygon
        points="-4,100 24,84 52,94 86,62 110,90 140,72 168,94 196,66 228,92 262,72 296,94 320,86 320,100 -4,100"
        fill={P.mntShade}
        opacity={0.3}
      />

      {/* rainbow */}
      <defs>
        <clipPath id="glitch-rainbow-clip">
          <rect x="66" y="28" width="188" height="72" />
        </clipPath>
      </defs>
      <g clipPath="url(#glitch-rainbow-clip)">
        <circle cx="160" cy="100" r="60" fill="none" stroke={P.rainbowA} strokeWidth="4" />
        <circle cx="160" cy="100" r="56" fill="none" stroke={P.rainbowB} strokeWidth="4" />
        <circle cx="160" cy="100" r="52" fill="none" stroke={P.rainbowC} strokeWidth="4" />
        <circle cx="160" cy="100" r="48" fill="none" stroke={P.rainbowD} strokeWidth="4" />
        <circle cx="160" cy="100" r="44" fill="none" stroke={P.rainbowE} strokeWidth="4" />
        <circle cx="160" cy="100" r="40" fill="none" stroke={P.rainbowF} strokeWidth="4" />
      </g>

      {/* floating islands */}
      <Sprite x={200} y={30} rows={ISLAND_ROWS} palette={ISLAND_PAL} px={2} />
      <Sprite x={218} y={24} rows={TREE_ROWS} palette={TREE_PAL_MD} px={2} />
      <Sprite x={96} y={48} rows={ISLAND_SM_ROWS} palette={ISLAND_PAL} px={2} />
      <Sprite x={102} y={42} rows={TREE_ROWS} palette={TREE_PAL_DK} px={1} />

      {/* forest silhouettes near horizon */}
      {forestLine.map((t, i) => (
        <Sprite key={`fst-${i}`} x={t.x} y={t.y} rows={TREE_ROWS} palette={t.palette} px={t.px} />
      ))}

      {/* big trees at the horizon — trunks reach the very bottom */}
      <Sprite x={8} y={62} rows={TREE_ROWS} palette={TREE_PAL_DK} px={4} />
      <Sprite x={280} y={64} rows={TREE_ROWS} palette={TREE_PAL_DK} px={4} />
    </svg>
  );
}

function GroundScene() {
  const flowers: Array<{ x: number; y: number; pal: Palette }> = [
    { x: 14, y: 40, pal: FLOWER_PAL(P.flower1) },
    { x: 32, y: 46, pal: FLOWER_PAL(P.flower2) },
    { x: 60, y: 42, pal: FLOWER_PAL(P.flower3) },
    { x: 78, y: 48, pal: FLOWER_PAL(P.flower1) },
    { x: 108, y: 44, pal: FLOWER_PAL(P.flower4) },
    { x: 166, y: 48, pal: FLOWER_PAL(P.flower2) },
    { x: 180, y: 42, pal: FLOWER_PAL(P.flower1) },
    { x: 232, y: 46, pal: FLOWER_PAL(P.flower3) },
    { x: 244, y: 42, pal: FLOWER_PAL(P.flower2) },
    { x: 270, y: 48, pal: FLOWER_PAL(P.flower1) },
    { x: 288, y: 44, pal: FLOWER_PAL(P.flower4) },
    { x: 308, y: 40, pal: FLOWER_PAL(P.flower3) },
  ];

  return (
    <svg
      viewBox="0 0 320 60"
      preserveAspectRatio="xMidYMin slice"
      shapeRendering="crispEdges"
      className="glitch-svg"
      aria-hidden
    >
      {/* grass shade band at horizon */}
      <rect x="0" y="0" width="320" height="2" fill={P.grassShade} />

      {/* grass tufts */}
      <g fill={P.grassShade}>
        {Array.from({ length: 56 }).map((_, i) => (
          <rect
            key={`tuft-${i}`}
            x={(i * 6 + 3) % 320}
            y={3 + ((i * 13) % 8)}
            width={2}
            height={2}
          />
        ))}
      </g>
      <g fill={P.grassDark}>
        {Array.from({ length: 40 }).map((_, i) => (
          <rect
            key={`tuftd-${i}`}
            x={(i * 11 + 5) % 320}
            y={14 + ((i * 7) % 36)}
            width={2}
            height={2}
          />
        ))}
      </g>

      {/* bushes */}
      <Sprite x={54} y={22} rows={BUSH_ROWS} palette={BUSH_PAL} px={2} />
      <Sprite x={228} y={24} rows={BUSH_ROWS} palette={BUSH_PAL} px={2} />
      <Sprite x={294} y={22} rows={BUSH_ROWS} palette={BUSH_PAL} px={2} />

      {/* flowers */}
      {flowers.map((f, i) => (
        <Sprite key={`f-${i}`} x={f.x} y={f.y} rows={FLOWER_ROWS} palette={f.pal} px={2} />
      ))}

      {/* pig */}
      <Sprite x={110} y={28} rows={PIG_ROWS} palette={PIG_PAL} px={3} />
      {/* chicken */}
      <Sprite x={180} y={28} rows={HEN_ROWS} palette={HEN_PAL} px={3} />

      {/* tiny Quanta mark */}
      <Sprite x={302} y={48} rows={LOGO_ROWS} palette={LOGO_PAL} px={1} />
    </svg>
  );
}

export function GlitchPage() {
  const nav = useDemoNav();
  return (
    <div className="glitch-page">
      <style>{GLITCH_CSS}</style>
      <div className="glitch-sky-layer" aria-hidden>
        <SkyScene />
      </div>
      <div className="glitch-ground-layer" aria-hidden>
        <GroundScene />
      </div>
      <div className="glitch-scanlines" aria-hidden />

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
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 100%;
  overflow: hidden;
  background: linear-gradient(
    to bottom,
    #bfe9f5 0%,
    #bfe9f5 28%,
    #d1eff5 50%,
    #e7f6f7 62%,
    #e7f6f7 65%,
    #7cc26a 65%,
    #7cc26a 82%,
    #5aa352 100%
  );
  image-rendering: pixelated;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
}

.glitch-sky-layer,
.glitch-ground-layer {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
}
.glitch-sky-layer {
  top: 0;
  height: 65%;
  overflow: hidden;
}
.glitch-ground-layer {
  bottom: 0;
  height: 35%;
  overflow: hidden;
}

.glitch-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
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
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(16px, 4vw, 48px);
  overflow: auto;
}

.glitch-card {
  width: min(560px, 92vw);
  background: #fafaf7;
  color: #1a1a1a;
  border: 2px solid #111;
  box-shadow:
    4px 0 0 #111,
    0 4px 0 #111,
    4px 4px 0 #111,
    10px 10px 0 rgba(17, 17, 17, 0.28);
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
  font-size: clamp(20px, 2.4vw, 28px);
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
