import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
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
      <g className="anim-sun">
        <Sprite x={268} y={8} rows={SUN_ROWS} palette={SUN_PAL} px={2} />
      </g>

      {/* clouds */}
      <g className="anim-cloud-a">
        <Sprite x={24} y={10} rows={CLOUD_ROWS} palette={CLOUD_PAL} px={2} />
      </g>
      <g className="anim-cloud-b">
        <Sprite x={102} y={2} rows={CLOUD_SM_ROWS} palette={CLOUD_PAL} px={2} />
      </g>
      <g className="anim-cloud-c">
        <Sprite x={196} y={22} rows={CLOUD_SM_ROWS} palette={CLOUD_PAL} px={2} />
      </g>
      <g className="anim-cloud-d">
        <Sprite x={150} y={34} rows={CLOUD_SM_ROWS} palette={CLOUD_PAL} px={1} />
      </g>

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
      <g clipPath="url(#glitch-rainbow-clip)" className="anim-rainbow">
        <circle cx="160" cy="100" r="60" fill="none" stroke={P.rainbowA} strokeWidth="4" />
        <circle cx="160" cy="100" r="56" fill="none" stroke={P.rainbowB} strokeWidth="4" />
        <circle cx="160" cy="100" r="52" fill="none" stroke={P.rainbowC} strokeWidth="4" />
        <circle cx="160" cy="100" r="48" fill="none" stroke={P.rainbowD} strokeWidth="4" />
        <circle cx="160" cy="100" r="44" fill="none" stroke={P.rainbowE} strokeWidth="4" />
        <circle cx="160" cy="100" r="40" fill="none" stroke={P.rainbowF} strokeWidth="4" />
      </g>

      {/* floating islands */}
      <g className="anim-island-big">
        <Sprite x={200} y={30} rows={ISLAND_ROWS} palette={ISLAND_PAL} px={2} />
        <Sprite x={218} y={24} rows={TREE_ROWS} palette={TREE_PAL_MD} px={2} />
      </g>
      <g className="anim-island-sm">
        <Sprite x={96} y={48} rows={ISLAND_SM_ROWS} palette={ISLAND_PAL} px={2} />
        <Sprite x={102} y={42} rows={TREE_ROWS} palette={TREE_PAL_DK} px={1} />
      </g>

      {/* forest silhouettes near horizon */}
      {forestLine.map((t, i) => (
        <Sprite key={`fst-${i}`} x={t.x} y={t.y} rows={TREE_ROWS} palette={t.palette} px={t.px} />
      ))}

      {/* big trees at the horizon — trunks reach the very bottom */}
      <g className="anim-tree-l">
        <Sprite x={8} y={62} rows={TREE_ROWS} palette={TREE_PAL_DK} px={4} />
      </g>
      <g className="anim-tree-r">
        <Sprite x={280} y={64} rows={TREE_ROWS} palette={TREE_PAL_DK} px={4} />
      </g>
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
      <g className="anim-pig">
        <Sprite x={110} y={28} rows={PIG_ROWS} palette={PIG_PAL} px={3} />
      </g>
      {/* chicken */}
      <g className="anim-chicken">
        <Sprite x={180} y={28} rows={HEN_ROWS} palette={HEN_PAL} px={3} />
      </g>

      {/* tiny Quanta mark */}
      <Sprite x={302} y={48} rows={LOGO_ROWS} palette={LOGO_PAL} px={1} />
    </svg>
  );
}

interface Apparition {
  emoji: string;
  top: string;
  left: string;
  dur: number;
  delay: number;
  size: number;
}

const APPARITIONS: readonly Apparition[] = [
  { emoji: "\u{1F437}", top: "62%", left: "22%", dur: 14, delay: 0,    size: 72 },
  { emoji: "\u{1F984}", top: "34%", left: "70%", dur: 17, delay: 3.5,  size: 84 },
  { emoji: "\u{1F996}", top: "58%", left: "86%", dur: 11, delay: 7,    size: 88 },
  { emoji: "\u{1F47E}", top: "38%", left: "12%", dur: 13, delay: 10,   size: 68 },
  { emoji: "\u{1F414}", top: "72%", left: "50%", dur: 15, delay: 2,    size: 64 },
  { emoji: "\u{1F980}", top: "78%", left: "16%", dur: 19, delay: 5,    size: 60 },
  { emoji: "\u{1F525}", top: "52%", left: "94%", dur: 16, delay: 12.5, size: 56 },
  { emoji: "\u{1F48E}", top: "28%", left: "40%", dur: 18, delay: 8,    size: 52 },
  { emoji: "\u{1FAA9}", top: "44%", left: "58%", dur: 21, delay: 14,   size: 80 },
  { emoji: "\u26A1",    top: "24%", left: "24%", dur: 9,  delay: 4,    size: 48 },
];

type SteveMode = "walk" | "idle" | "look" | "dance";

const SteveModeWeights: Array<{ mode: SteveMode; w: number }> = [
  { mode: "idle",  w: 0.45 },
  { mode: "look",  w: 0.30 },
  { mode: "dance", w: 0.25 },
];
function pickSteveIdleMode(): SteveMode {
  const r = Math.random();
  let acc = 0;
  for (const { mode, w } of SteveModeWeights) {
    acc += w;
    if (r < acc) return mode;
  }
  return "idle";
}

function MinecraftSteve() {
  const [pos, setPos] = useState({ y: 8, scale: 1 });
  const [mode, setMode] = useState<SteveMode>("walk");
  const marchRef = useRef<HTMLDivElement>(null);

  // Randomize Y + scale at the start of each march cycle (depth variation)
  useEffect(() => {
    const el = marchRef.current;
    if (!el) return;
    const reroll = () => {
      const y = 2 + Math.random() * 26;      // 2% (foreground) — 28% (horizon)
      const depth = 1 - (y - 2) / 26;        // 1 = close, 0 = far
      const scale = 0.45 + depth * 0.95;     // 0.45 → 1.4
      setPos({ y, scale });
    };
    reroll();
    el.addEventListener("animationiteration", reroll);
    return () => el.removeEventListener("animationiteration", reroll);
  }, []);

  // Random walk ↔ idle scheduler
  useEffect(() => {
    let id: number | undefined;
    if (mode === "walk") {
      id = window.setTimeout(() => setMode(pickSteveIdleMode()), 3800 + Math.random() * 6000);
    } else {
      id = window.setTimeout(() => setMode("walk"), 1500 + Math.random() * 3000);
    }
    return () => { if (id !== undefined) clearTimeout(id); };
  }, [mode]);

  const style: CSSProperties = {
    bottom: `${pos.y}%`,
    transform: `scale(${pos.scale})`,
    zIndex: Math.round(pos.scale * 4),
  };

  return (
    <div
      ref={marchRef}
      className="mc-steve"
      data-mode={mode}
      style={style}
      aria-hidden
    >
      <div className="mc-steve__tag">not_steve</div>
      <div className="mc-steve__spin">
        <div className="mc-steve__rig">
          {/* Head */}
          <div className="mc-cube mc-head">
            <div className="mc-face mc-face--front mc-head__front">
              <span className="mc-head__eyes" />
              <span className="mc-head__mouth" />
            </div>
            <div className="mc-face mc-face--back" />
            <div className="mc-face mc-face--left" />
            <div className="mc-face mc-face--right" />
            <div className="mc-face mc-face--top" />
            <div className="mc-face mc-face--bottom" />
          </div>

          {/* Body */}
          <div className="mc-cube mc-body">
            <div className="mc-face mc-face--front" />
            <div className="mc-face mc-face--back" />
            <div className="mc-face mc-face--left" />
            <div className="mc-face mc-face--right" />
            <div className="mc-face mc-face--top" />
            <div className="mc-face mc-face--bottom" />
          </div>

          {/* Arms */}
          <div className="mc-arm mc-arm--left">
            <div className="mc-cube mc-limb">
              <div className="mc-face mc-face--front" />
              <div className="mc-face mc-face--back" />
              <div className="mc-face mc-face--left" />
              <div className="mc-face mc-face--right" />
              <div className="mc-face mc-face--top" />
              <div className="mc-face mc-face--bottom" />
            </div>
          </div>
          <div className="mc-arm mc-arm--right">
            <div className="mc-cube mc-limb">
              <div className="mc-face mc-face--front" />
              <div className="mc-face mc-face--back" />
              <div className="mc-face mc-face--left" />
              <div className="mc-face mc-face--right" />
              <div className="mc-face mc-face--top" />
              <div className="mc-face mc-face--bottom" />
            </div>
          </div>

          {/* Legs */}
          <div className="mc-leg mc-leg--left">
            <div className="mc-cube mc-limb mc-limb--leg">
              <div className="mc-face mc-face--front" />
              <div className="mc-face mc-face--back" />
              <div className="mc-face mc-face--left" />
              <div className="mc-face mc-face--right" />
              <div className="mc-face mc-face--top" />
              <div className="mc-face mc-face--bottom" />
            </div>
          </div>
          <div className="mc-leg mc-leg--right">
            <div className="mc-cube mc-limb mc-limb--leg">
              <div className="mc-face mc-face--front" />
              <div className="mc-face mc-face--back" />
              <div className="mc-face mc-face--left" />
              <div className="mc-face mc-face--right" />
              <div className="mc-face mc-face--top" />
              <div className="mc-face mc-face--bottom" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MinecraftCreeper() {
  const [pos, setPos] = useState({ y: 6, scale: 1 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reroll = () => {
      const y = 3 + Math.random() * 22;
      const depth = 1 - (y - 3) / 22;
      const scale = 0.4 + depth * 0.9;
      setPos({ y, scale });
    };
    reroll();
    el.addEventListener("animationiteration", reroll);
    return () => el.removeEventListener("animationiteration", reroll);
  }, []);

  const style: CSSProperties = {
    bottom: `${pos.y}%`,
    transform: `scale(${pos.scale})`,
    zIndex: Math.round(pos.scale * 4),
  };

  return (
    <div
      ref={ref}
      className="mc-creeper"
      style={style}
      aria-hidden
    >
      <div className="mc-creeper__rig">
        {/* Creeper head */}
        <div className="mc-cube mc-creeper__head">
          <div className="mc-face mc-face--front mc-creeper__face">
            <span className="mc-creeper__eye mc-creeper__eye--l" />
            <span className="mc-creeper__eye mc-creeper__eye--r" />
            <span className="mc-creeper__mouth" />
          </div>
          <div className="mc-face mc-face--back" />
          <div className="mc-face mc-face--left" />
          <div className="mc-face mc-face--right" />
          <div className="mc-face mc-face--top" />
          <div className="mc-face mc-face--bottom" />
        </div>
        {/* Body */}
        <div className="mc-cube mc-creeper__body">
          <div className="mc-face mc-face--front" />
          <div className="mc-face mc-face--back" />
          <div className="mc-face mc-face--left" />
          <div className="mc-face mc-face--right" />
          <div className="mc-face mc-face--top" />
          <div className="mc-face mc-face--bottom" />
        </div>
        {/* Four stubby legs */}
        {["fl", "fr", "bl", "br"].map((id) => (
          <div key={id} className={`mc-creeper__leg mc-creeper__leg--${id}`}>
            <div className="mc-cube mc-creeper__foot">
              <div className="mc-face mc-face--front" />
              <div className="mc-face mc-face--back" />
              <div className="mc-face mc-face--left" />
              <div className="mc-face mc-face--right" />
              <div className="mc-face mc-face--top" />
              <div className="mc-face mc-face--bottom" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GlitchApparitions() {
  return (
    <div className="glitch-apparitions" aria-hidden>
      {APPARITIONS.map((a, i) => (
        <div
          key={i}
          className="glitch-apparition"
          style={{
            top: a.top,
            left: a.left,
            fontSize: `clamp(36px, ${a.size / 16}vw, ${a.size}px)`,
            animationDelay: `${a.delay}s`,
            animationDuration: `${a.dur}s`,
          }}
        >
          <span className="glitch-apparition__glyph">{a.emoji}</span>
        </div>
      ))}
    </div>
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
      <MinecraftCreeper />
      <MinecraftSteve />
      <GlitchApparitions />
      <div className="glitch-scanlines" aria-hidden />
      <div className="glitch-band" aria-hidden />

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

/* =========================================================================
   Pixel character animations (run inside the SVGs)
   ========================================================================= */

.anim-sun {
  transform-box: fill-box;
  transform-origin: center;
  animation: glitch-sun-pulse 4.2s ease-in-out infinite;
}
@keyframes glitch-sun-pulse {
  0%, 100% { filter: brightness(1); transform: scale(1); }
  50%      { filter: brightness(1.18); transform: scale(1.04); }
}

.anim-cloud-a { animation: glitch-cloud-drift 36s ease-in-out infinite; }
.anim-cloud-b { animation: glitch-cloud-drift 48s ease-in-out infinite -8s; }
.anim-cloud-c { animation: glitch-cloud-drift 58s ease-in-out infinite -22s; }
.anim-cloud-d { animation: glitch-cloud-drift 70s ease-in-out infinite -40s; }
@keyframes glitch-cloud-drift {
  0%, 100% { transform: translateX(0); }
  50%      { transform: translateX(14px); }
}

.anim-rainbow {
  animation: glitch-rainbow-flicker 9s steps(1) infinite;
}
@keyframes glitch-rainbow-flicker {
  0%, 86%, 100%  { opacity: 1; }
  87%            { opacity: 0.3; }
  88%            { opacity: 0.85; }
  89%            { opacity: 0.15; }
  90%            { opacity: 1; }
  94%            { opacity: 0.6; }
  95%            { opacity: 1; }
}

.anim-island-big { animation: glitch-island-bob 6.4s ease-in-out infinite; }
.anim-island-sm  { animation: glitch-island-bob 4.8s ease-in-out infinite -1.5s; }
@keyframes glitch-island-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-2px); }
}

.anim-tree-l {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: glitch-tree-sway-l 7s ease-in-out infinite;
}
.anim-tree-r {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: glitch-tree-sway-r 6.2s ease-in-out infinite -1.2s;
}
@keyframes glitch-tree-sway-l {
  0%, 100% { transform: rotate(-0.6deg); }
  50%      { transform: rotate(0.8deg); }
}
@keyframes glitch-tree-sway-r {
  0%, 100% { transform: rotate(0.7deg); }
  50%      { transform: rotate(-0.7deg); }
}

.anim-pig {
  animation: glitch-pig-trot 5.5s ease-in-out infinite;
}
@keyframes glitch-pig-trot {
  0%, 100% { transform: translate(0, 0); }
  20%      { transform: translate(4px, -1px); }
  40%      { transform: translate(8px, 0); }
  55%      { transform: translate(10px, -1px); }
  70%      { transform: translate(6px, 0); }
  85%      { transform: translate(2px, -1px); }
}

.anim-chicken {
  animation: glitch-chicken-bob 0.7s ease-in-out infinite;
}
@keyframes glitch-chicken-bob {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(0, -1px); }
}

/* =========================================================================
   3D emoji apparitions — glitch world bleed-throughs
   ========================================================================= */

.glitch-apparitions {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}

.glitch-apparition {
  position: absolute;
  line-height: 1;
  opacity: 0;
  transform: translate(-50%, -50%);
  animation-name: glitch-apparition;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
  will-change: transform, opacity, filter;
  filter: drop-shadow(0 6px 14px rgba(17, 17, 17, 0.35));
}

.glitch-apparition__glyph {
  display: inline-block;
  /* Use emoji-friendly fonts so the glyph renders as the system's 3D-ish emoji */
  font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji",
               "Twemoji Mozilla", system-ui, sans-serif;
  text-shadow:
    2px 0 rgba(232, 91, 91, 0.85),
    -2px 0 rgba(106, 169, 224, 0.85);
}

@keyframes glitch-apparition {
  0%, 84%       { opacity: 0; transform: translate(-50%, -50%) scale(0.35) rotate(-14deg); filter: blur(10px) saturate(240%) hue-rotate(0deg); }
  85%           { opacity: 1; transform: translate(-50%, -50%) scale(1.35) rotate(6deg);   filter: blur(0) saturate(320%) hue-rotate(60deg); }
  85.6%         { opacity: 1; transform: translate(-45%, -50%) scale(1.18);                filter: hue-rotate(-90deg) saturate(400%); }
  86.2%         { opacity: 1; transform: translate(-55%, -50%) scale(1.18);                filter: hue-rotate(130deg) saturate(320%); }
  87%           { opacity: 1; transform: translate(-50%, -50%) scale(1.02);                filter: none; }
  90%           { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  92%           { opacity: 0.85; transform: translate(-50%, -48%) scale(1) rotate(-3deg); }
  93%           { opacity: 0.35; transform: translate(-52%, -52%) scale(1.15) rotate(5deg); filter: hue-rotate(-45deg) blur(1px); }
  94%           { opacity: 0;    transform: translate(-50%, -50%) scale(0.5);               filter: blur(14px) hue-rotate(200deg); }
  100%          { opacity: 0; }
}

/* Occasional full-width glitch band sweeping across the screen */
.glitch-band {
  position: absolute;
  left: -4%;
  right: -4%;
  top: 0;
  height: 100%;
  z-index: 1;
  pointer-events: none;
  background:
    repeating-linear-gradient(
      to bottom,
      rgba(232, 91, 91, 0)  0px,
      rgba(232, 91, 91, 0)  6px,
      rgba(232, 91, 91, 0.14) 7px,
      rgba(232, 91, 91, 0)  8px
    );
  mix-blend-mode: screen;
  opacity: 0;
  animation: glitch-band-sweep 11s steps(1) infinite;
}
@keyframes glitch-band-sweep {
  0%, 92%, 100%  { opacity: 0;   transform: translateY(0); }
  93%            { opacity: 0.9; transform: translateY(-8px) skewX(2deg); }
  93.5%          { opacity: 0.6; transform: translateY(14px) skewX(-3deg); }
  94%            { opacity: 0.9; transform: translateY(-6px) skewX(1deg); }
  94.5%          { opacity: 0; }
}

/* =========================================================================
   CSS 3D Minecraft Steve — real 3D cubes built from 6 faces each
   ========================================================================= */

.mc-steve {
  position: absolute;
  bottom: 8%;
  left: 0;
  z-index: 1;
  width: 40px;
  height: 160px;
  perspective: 700px;
  pointer-events: none;
  animation: mc-march 26s linear infinite;
}
@keyframes mc-march {
  0%   { left: -10%; }
  100% { left: 108%; }
}

.mc-steve__tag {
  position: absolute;
  top: -26px;
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 5px;
  font-family: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.05em;
  color: #fff;
  background: rgba(17, 17, 17, 0.55);
  border-radius: 2px;
  white-space: nowrap;
  text-shadow: 1px 1px 0 #000;
  z-index: 2;
}

.mc-steve__spin {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  animation: mc-glitch-spin 18s steps(1) infinite;
}
@keyframes mc-glitch-spin {
  0%, 94%, 100% { transform: rotateY(0deg); filter: none; }
  95%           { transform: rotateY(120deg); filter: hue-rotate(60deg) saturate(2); }
  96%           { transform: rotateY(240deg); filter: hue-rotate(-90deg) saturate(2); }
  97%           { transform: rotateY(340deg); filter: none; }
  98%           { transform: rotateY(360deg); }
}

.mc-steve__rig {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  animation: mc-rig-bob 0.55s ease-in-out infinite;
}
@keyframes mc-rig-bob {
  0%, 100% { transform: rotateX(-6deg) rotateY(-28deg) translateY(0); }
  50%      { transform: rotateX(-6deg) rotateY(-28deg) translateY(-2px); }
}

/* --- Generic cube scaffolding --- */
.mc-cube {
  position: absolute;
  transform-style: preserve-3d;
}
.mc-face {
  position: absolute;
  left: 50%;
  top: 50%;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
  background-repeat: no-repeat;
}
.mc-face--front  { width: var(--w); height: var(--h); transform: translate(-50%, -50%) translateZ(calc(var(--d) / 2)); }
.mc-face--back   { width: var(--w); height: var(--h); transform: translate(-50%, -50%) rotateY(180deg) translateZ(calc(var(--d) / 2)); }
.mc-face--right  { width: var(--d); height: var(--h); transform: translate(-50%, -50%) rotateY(90deg) translateZ(calc(var(--w) / 2)); }
.mc-face--left   { width: var(--d); height: var(--h); transform: translate(-50%, -50%) rotateY(-90deg) translateZ(calc(var(--w) / 2)); }
.mc-face--top    { width: var(--w); height: var(--d); transform: translate(-50%, -50%) rotateX(90deg) translateZ(calc(var(--h) / 2)); }
.mc-face--bottom { width: var(--w); height: var(--d); transform: translate(-50%, -50%) rotateX(-90deg) translateZ(calc(var(--h) / 2)); }

/* --- Steve palette --- */
/* skin #c68863, skin-dk #a06848, hair #2a1a10, shirt #28a0c8, shirt-dk #2280a8,
   pants #384080, pants-dk #2a3068, shoe #1a1a1a */

/* --- Head cube (8x8x8 MC blocks => 40x40x40px) --- */
.mc-head {
  --w: 40px; --h: 40px; --d: 40px;
  width: var(--w); height: var(--h);
  top: 0; left: 0;
}
.mc-head .mc-face--front  { background: #c68863; }
.mc-head .mc-face--back   { background: #2a1a10; }
.mc-head .mc-face--left,
.mc-head .mc-face--right  { background: linear-gradient(to bottom, #2a1a10 0%, #2a1a10 25%, #a06848 25%, #a06848 100%); }
.mc-head .mc-face--top    { background: #2a1a10; }
.mc-head .mc-face--bottom { background: #9f6244; }

.mc-head__front {
  position: relative;
}
.mc-head__eyes {
  position: absolute;
  top: 20px; left: 10px;
  width: 5px; height: 5px;
  background: #fff;
  box-shadow:
    5px 0 0 #2050a0,
    15px 0 0 #fff,
    20px 0 0 #2050a0;
}
.mc-head__mouth {
  position: absolute;
  top: 30px; left: 12px;
  width: 16px; height: 3px;
  background: #6a3420;
}

/* --- Body (8x12x4 MC => 40x60x20 px) --- */
.mc-body {
  --w: 40px; --h: 60px; --d: 20px;
  width: var(--w); height: var(--h);
  top: 40px; left: 0;
}
.mc-body .mc-face--front,
.mc-body .mc-face--back   { background: #28a0c8; }
.mc-body .mc-face--left,
.mc-body .mc-face--right  { background: #2280a8; }
.mc-body .mc-face--top    { background: #22b4d0; }
.mc-body .mc-face--bottom { background: #1a6a8a; }

/* --- Arms (4x12x4 MC => 20x60x20 px) --- */
.mc-arm {
  position: absolute;
  top: 40px;
  width: 20px;
  height: 60px;
  transform-style: preserve-3d;
}
.mc-arm--left  { left: -20px; transform-origin: 50% 0 50%; animation: mc-swing-a 0.6s ease-in-out infinite; }
.mc-arm--right { left: 40px;  transform-origin: 50% 0 50%; animation: mc-swing-b 0.6s ease-in-out infinite; }
@keyframes mc-swing-a {
  0%, 100% { transform: rotateX(35deg); }
  50%      { transform: rotateX(-35deg); }
}
@keyframes mc-swing-b {
  0%, 100% { transform: rotateX(-35deg); }
  50%      { transform: rotateX(35deg); }
}

.mc-limb {
  --w: 20px; --h: 60px; --d: 20px;
  width: var(--w); height: var(--h);
  top: 0; left: 0;
}
/* Arm faces: shirt upper half, skin lower half */
.mc-arm .mc-limb .mc-face--front,
.mc-arm .mc-limb .mc-face--back {
  background: linear-gradient(to bottom, #28a0c8 0%, #28a0c8 50%, #c68863 50%, #c68863 100%);
}
.mc-arm .mc-limb .mc-face--left,
.mc-arm .mc-limb .mc-face--right {
  background: linear-gradient(to bottom, #2280a8 0%, #2280a8 50%, #a06848 50%, #a06848 100%);
}
.mc-arm .mc-limb .mc-face--top    { background: #28a0c8; }
.mc-arm .mc-limb .mc-face--bottom { background: #c68863; }

/* --- Legs (4x12x4 MC => 20x60x20 px) --- */
.mc-leg {
  position: absolute;
  top: 100px;
  width: 20px;
  height: 60px;
  transform-style: preserve-3d;
}
.mc-leg--left  { left: 0;   transform-origin: 50% 0 50%; animation: mc-swing-b 0.6s ease-in-out infinite; }
.mc-leg--right { left: 20px; transform-origin: 50% 0 50%; animation: mc-swing-a 0.6s ease-in-out infinite; }

.mc-leg .mc-limb--leg .mc-face--front,
.mc-leg .mc-limb--leg .mc-face--back   { background: #384080; }
.mc-leg .mc-limb--leg .mc-face--left,
.mc-leg .mc-limb--leg .mc-face--right  { background: #2a3068; }
.mc-leg .mc-limb--leg .mc-face--top    { background: #384080; }
.mc-leg .mc-limb--leg .mc-face--bottom { background: #1a1a1a; }

/* =========================================================================
   Minecraft Creeper — sneaks in from the right every now and then
   ========================================================================= */

.mc-creeper {
  position: absolute;
  bottom: 7%;
  left: 0;
  z-index: 1;
  width: 50px;
  height: 160px;
  perspective: 700px;
  pointer-events: none;
  opacity: 0;
  animation: mc-creeper-enter 34s linear infinite;
  animation-delay: 12s;
}
@keyframes mc-creeper-enter {
  0%, 3%       { opacity: 0; left: 108%; }
  4%           { opacity: 1; left: 106%; }
  48%          { opacity: 1; left: 32%; }
  52%          { opacity: 1; left: 32%; transform: translateY(-4px); }
  53%, 57%     { opacity: 1; transform: translateY(-4px) scale(1.12); filter: saturate(3) brightness(1.3); }
  60%          { opacity: 0; transform: scale(1.8); filter: brightness(3) blur(4px); }
  61%, 100%    { opacity: 0; left: -10%; }
}

.mc-creeper__rig {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transform: rotateX(-4deg) rotateY(18deg);
  animation: mc-creeper-bob 0.8s ease-in-out infinite;
}
@keyframes mc-creeper-bob {
  0%, 100% { transform: rotateX(-4deg) rotateY(18deg) translateY(0); }
  50%      { transform: rotateX(-4deg) rotateY(18deg) translateY(-2px); }
}

/* Head 40x40x40 */
.mc-creeper__head {
  --w: 40px; --h: 40px; --d: 40px;
  width: var(--w); height: var(--h);
  top: 0; left: 5px;
}
.mc-creeper__head .mc-face { background: #5a9c45; }
.mc-creeper__head .mc-face--left,
.mc-creeper__head .mc-face--right { background: #3c7c30; }
.mc-creeper__head .mc-face--top { background: #6eb855; }
.mc-creeper__head .mc-face--bottom { background: #2f5a22; }

.mc-creeper__face { position: relative; }
.mc-creeper__eye {
  position: absolute;
  width: 6px; height: 8px;
  background: #111;
  top: 14px;
  box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.08);
}
.mc-creeper__eye--l { left: 10px; }
.mc-creeper__eye--r { right: 10px; }
.mc-creeper__mouth {
  position: absolute;
  left: 13px;
  top: 22px;
  width: 14px;
  height: 12px;
  background:
    linear-gradient(to bottom,
      #111 0, #111 3px,
      transparent 3px, transparent 5px,
      #111 5px, #111 9px,
      transparent 9px, transparent 12px);
  clip-path: polygon(
    30% 0, 70% 0, 70% 25%, 100% 25%, 100% 75%, 70% 75%, 70% 100%, 30% 100%, 30% 75%, 0 75%, 0 25%, 30% 25%
  );
}

/* Body 40x30x20 */
.mc-creeper__body {
  --w: 40px; --h: 30px; --d: 20px;
  width: var(--w); height: var(--h);
  top: 40px; left: 5px;
}
.mc-creeper__body .mc-face { background: #5a9c45; }
.mc-creeper__body .mc-face--left,
.mc-creeper__body .mc-face--right { background: #3c7c30; }
.mc-creeper__body .mc-face--top { background: #6eb855; }

/* Four legs 10x20x14 */
.mc-creeper__leg {
  position: absolute;
  top: 70px;
  width: 10px;
  height: 20px;
  transform-style: preserve-3d;
  transform-origin: 50% 0 50%;
  animation: mc-creeper-leg 0.8s ease-in-out infinite;
}
.mc-creeper__leg--fl { left: 6px;  }
.mc-creeper__leg--fr { left: 34px; animation-delay: -0.4s; }
.mc-creeper__leg--bl { left: 6px;  top: 70px; transform: translateZ(-10px); animation-delay: -0.4s; }
.mc-creeper__leg--br { left: 34px; top: 70px; transform: translateZ(-10px); }
@keyframes mc-creeper-leg {
  0%, 100% { transform: rotateX(12deg); }
  50%      { transform: rotateX(-12deg); }
}

.mc-creeper__foot {
  --w: 10px; --h: 20px; --d: 14px;
  width: var(--w); height: var(--h);
  top: 0; left: 0;
}
.mc-creeper__foot .mc-face { background: #5a9c45; }
.mc-creeper__foot .mc-face--left,
.mc-creeper__foot .mc-face--right { background: #3c7c30; }
.mc-creeper__foot .mc-face--bottom { background: #1a1a1a; }

@media (prefers-reduced-motion: reduce) {
  .anim-sun, .anim-cloud-a, .anim-cloud-b, .anim-cloud-c, .anim-cloud-d,
  .anim-rainbow, .anim-island-big, .anim-island-sm, .anim-tree-l, .anim-tree-r,
  .anim-pig, .anim-chicken, .glitch-apparition, .glitch-band,
  .mc-steve, .mc-steve__spin, .mc-steve__rig,
  .mc-arm--left, .mc-arm--right, .mc-leg--left, .mc-leg--right,
  .mc-creeper, .mc-creeper__rig, .mc-creeper__leg,
  .glitch-card__heading::before, .glitch-card__heading::after {
    animation: none !important;
  }
}
`;
