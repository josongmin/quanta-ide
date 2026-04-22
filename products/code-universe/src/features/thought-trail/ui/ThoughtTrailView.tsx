// ThoughtTrailView — commit messages as a vertical column-cluster flow.
// --------------------------------------------------------------------
// Fabricates ~40 seeded commits from the entity tree (no real git).
// Layout:
//   • 4 vertical columns, one per topic bucket (bug/feature/refactor/chore)
//   • Each column = a stack of bubbles bound by thin tapered beziers
//   • Hover a bubble → right panel lists "related files" (3-6 entities
//     chosen via seeded pick from tree)
//
// Visual palette stays restrained: neutral bubble body, category-tinted
// dot + hover ring. Hashes + timestamps use mono; messages use sans.
// Entrance: root fade/scale + per-bubble stagger.

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Entity } from "@quanta/canvas-engine";
import type { EntityTree } from "../../../entities/entity";
import {
  color as tokenColor,
  font,
  radius,
  space,
  transition,
} from "../../../shared/ui/tokens";
import { hashId, mulberry32 } from "../../../shared/analytics/synth-metrics";

// ── Props ─────────────────────────────────────────────────────────────

export interface ThoughtTrailViewProps {
  tree: EntityTree;
  onFocusEntity?: (id: string) => void;
}

// ── Topics + messages ────────────────────────────────────────────────

type Topic = "bug" | "feature" | "refactor" | "chore";

const TOPIC_ORDER: readonly Topic[] = ["bug", "feature", "refactor", "chore"];

const TOPIC_LABEL: Readonly<Record<Topic, string>> = {
  bug: "Fixes",
  feature: "Features",
  refactor: "Refactors",
  chore: "Chores",
};

// Topic palette — bug/feature map to semantic tokens; refactor/chore use
// token-derived kind hues so nothing escapes the central palette.
const TOPIC_COLOR: Readonly<Record<Topic, string>> = {
  bug: tokenColor.danger,
  feature: tokenColor.accent,
  refactor: tokenColor.kindUniverse,
  chore: tokenColor.text2,
};

const MESSAGES_BY_TOPIC: Readonly<Record<Topic, readonly string[]>> = {
  bug: [
    "fix: handle null selection in inspector",
    "fix(auth): ignore empty tokens",
    "fix: prevent NaN in layout packer",
    "fix: escape viewport pinch-zoom leak",
    "fix: race when graph loads after canvas mount",
    "fix: dedupe commit entries on sync",
    "fix: guard against undefined parentId",
    "fix: restore focus after overlay dismiss",
  ],
  feature: [
    "feat: add timelapse playback",
    "feat: inline symbol diff in overlay",
    "feat: pan-to-edge on long selection",
    "feat: mini-map hover preview",
    "feat: folder heat search",
    "feat: commit-thread trail view",
    "feat(canvas): MSDF font atlas",
    "feat: accent theming tokens",
  ],
  refactor: [
    "refactor: extract canvas-engine layer",
    "refactor: collapse duplicate selectors",
    "refactor: move tokens to shared/ui",
    "refactor: split view-mode store",
    "refactor: normalize entity ids",
    "refactor: swap bezier for tapered quadratic",
    "refactor: fold heuristics into central handler",
    "refactor(tree): cache descendant walks",
  ],
  chore: [
    "chore: bump deps",
    "chore: tighten eslint ignore",
    "chore(ci): cache pnpm store",
    "docs: update readme",
    "test: cover edge case",
    "perf: memo heavy computed",
    "chore: redirect artifacts outside repo",
    "chore: bump tauri v2",
  ],
};

// ── Commit shape ─────────────────────────────────────────────────────

interface Commit {
  idx: number;
  seed: number;
  hash: string;
  message: string;
  topic: Topic;
  daysAgo: number;
  relatedIds: string[];
}

// ── Build commits deterministically from tree ────────────────────────

const N_COMMITS = 40;

function fmtDaysAgo(d: number): string {
  if (d === 0) return "today";
  if (d === 1) return "1d";
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.round(d / 7)}w`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${Math.round(d / 365)}y`;
}

function buildCommits(tree: EntityTree): Commit[] {
  const rootId = tree.rootId;
  const buildings: Entity[] = [];
  for (const e of tree.byId.values()) {
    if (e.kind === "building") buildings.push(e);
  }
  const commits: Commit[] = [];
  for (let i = 0; i < N_COMMITS; i++) {
    const seed = hashId(`commit:${i}:${rootId}`);
    const rng = mulberry32(seed);
    const topicIdx = seed % 4;
    const topic = TOPIC_ORDER[topicIdx] ?? "feature";
    const pool = MESSAGES_BY_TOPIC[topic];
    const message = pool[Math.floor(rng() * pool.length)] ?? pool[0]!;
    const hash = seed.toString(16).padStart(7, "0").slice(0, 7);

    // newer commits near index 0; older near N-1 (simulate descending log)
    const daysAgo = Math.floor(Math.pow(i / Math.max(1, N_COMMITS - 1), 1.3) * 120);

    // pick 2-4 related files deterministically
    const nRel = 2 + Math.floor(rng() * 3);
    const related: string[] = [];
    const seen = new Set<string>();
    for (let k = 0; k < nRel && buildings.length > 0; k++) {
      const pick = buildings[Math.floor(rng() * buildings.length)];
      if (pick && !seen.has(pick.id)) {
        seen.add(pick.id);
        related.push(pick.id);
      }
    }

    commits.push({
      idx: i,
      seed,
      hash,
      message,
      topic,
      daysAgo,
      relatedIds: related,
    });
  }
  return commits;
}

// ── Layout ───────────────────────────────────────────────────────────

interface Positioned extends Commit {
  x: number;
  y: number;
  col: number;
  colIdx: number;
}

interface Layout {
  width: number;
  height: number;
  byCol: Map<Topic, Positioned[]>;
  all: Positioned[];
}

const COL_GAP_Y = 62; // vertical spacing between bubbles
const COL_TOP = 62;
const BUBBLE_R = 6;
const BUBBLE_W = 218;
const BUBBLE_H = 44;

function layoutCommits(commits: Commit[], width: number): Layout {
  // Distribute commits into topic columns, keep within-column newest-first.
  const byCol = new Map<Topic, Positioned[]>();
  for (const t of TOPIC_ORDER) byCol.set(t, []);
  for (const c of commits) {
    const bucket = byCol.get(c.topic);
    if (bucket) bucket.push({ ...c, x: 0, y: 0, col: 0, colIdx: 0 });
  }
  // Sort each bucket by idx ascending (idx 0 = newest).
  for (const [, b] of byCol) b.sort((a, b2) => a.idx - b2.idx);

  const colCount = TOPIC_ORDER.length;
  const marginX = 60;
  const usableW = Math.max(640, width) - marginX * 2;
  const colStep = usableW / colCount;
  const all: Positioned[] = [];
  let maxCount = 0;

  for (let ci = 0; ci < TOPIC_ORDER.length; ci++) {
    const topic = TOPIC_ORDER[ci]!;
    const bucket = byCol.get(topic)!;
    if (bucket.length > maxCount) maxCount = bucket.length;
    const xCenter = marginX + colStep * ci + colStep / 2;
    for (let k = 0; k < bucket.length; k++) {
      const b = bucket[k]!;
      // Mild horizontal zigzag inside the column gives the flow an organic
      // hand-drawn feel without breaking the column grid.
      const rng = mulberry32(b.seed ^ 0x7f10);
      const zig = (rng() - 0.5) * 16;
      b.x = xCenter + zig;
      b.y = COL_TOP + k * COL_GAP_Y;
      b.col = ci;
      b.colIdx = k;
      all.push(b);
    }
  }

  const height = COL_TOP + Math.max(1, maxCount) * COL_GAP_Y + 40;
  return { width: Math.max(640, width), height, byCol, all };
}

// ── Bezier helpers ───────────────────────────────────────────────────

function taperedBezierPath(
  x1: number, y1: number,
  x2: number, y2: number,
): string {
  // Vertical bias: two control points pulled along the column axis.
  const dy = y2 - y1;
  const cy1 = y1 + dy * 0.45;
  const cy2 = y2 - dy * 0.45;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} C${x1.toFixed(1)},${cy1.toFixed(1)} ${x2.toFixed(1)},${cy2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

// ── Keyframes ────────────────────────────────────────────────────────

const STYLE_ID = "thought-trail-view-styles";
function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes ttv-enter {
      from { opacity: 0; transform: scale(0.985); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes ttv-bubble-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ttv-edge-in {
      from { stroke-dashoffset: 240; opacity: 0; }
      to   { stroke-dashoffset: 0;   opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ── Main ──────────────────────────────────────────────────────────────

const ENTRY_MS = 520;
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const STAGGER_MS = 18;

function ThoughtTrailViewImpl({ tree, onFocusEntity }: ThoughtTrailViewProps) {
  injectStyles();

  const [panelSize, setPanelSize] = useState({ w: 900, h: 600 });
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Observe the scroll area to compute layout width.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0];
      if (r) {
        setPanelSize({ w: r.contentRect.width, h: r.contentRect.height });
      }
    });
    ro.observe(el);
    setPanelSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const commits = useMemo(() => buildCommits(tree), [tree]);

  const layout = useMemo(
    () => layoutCommits(commits, panelSize.w),
    [commits, panelSize.w],
  );

  const activeId = hoveredId ?? pinnedId;
  const active = activeId !== null ? layout.all.find(c => c.idx === activeId) ?? null : null;

  const activeRelated: Entity[] = useMemo(() => {
    if (!active) return [];
    const out: Entity[] = [];
    for (const id of active.relatedIds) {
      const e = tree.byId.get(id);
      if (e) out.push(e);
    }
    return out;
  }, [active, tree]);

  const handleSelect = useCallback(
    (idx: number) => {
      setPinnedId(prev => (prev === idx ? null : idx));
    },
    [],
  );

  // ── Styles ──────────────────────────────────────────────────────────

  const rootStyle: CSSProperties = {
    display: "flex",
    width: "100%",
    height: "100%",
    background: tokenColor.bg0,
    color: tokenColor.text0,
    fontFamily: font.sans,
    animation: `ttv-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    overflow: "hidden",
  };

  const leftStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    padding: `${space[4]}px ${space[5]}px 0`,
    overflow: "hidden",
  };

  const rightStyle: CSSProperties = {
    width: 300,
    flexShrink: 0,
    borderLeft: `1px solid ${tokenColor.border}`,
    background: tokenColor.bg2,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: space[3],
    flexShrink: 0,
  };

  return (
    <div style={rootStyle} role="region" aria-label="Thought trail commit flow">
      {/* ── LEFT: trail canvas ─────────────────────────────────────── */}
      <div style={leftStyle}>
        <div style={headerStyle}>
          <div>
            <div
              style={{
                fontSize: font.size.display,
                fontWeight: font.weight.bold,
                lineHeight: 1.15,
                letterSpacing: font.letter.tight as number,
              }}
            >
              Trail
            </div>
            <div style={{ fontSize: font.size.xs, color: tokenColor.text2, marginTop: 2 }}>
              커밋 사고의 궤적 · commit message 임베딩 × 파일 변경
            </div>
          </div>
          <TopicLegend />
        </div>

        <div
          ref={scrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            border: `1px solid ${tokenColor.border}`,
            borderRadius: radius.md,
            background: tokenColor.bg1,
            position: "relative",
          }}
        >
          <svg
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            style={{ display: "block", background: "transparent", userSelect: "none" }}
            role="img"
            aria-label="Commit trail graph"
          >
            <defs>
              <pattern id="ttv-dotgrid" x={0} y={0} width={22} height={22} patternUnits="userSpaceOnUse">
                <circle cx={11} cy={11} r={0.8} fill={tokenColor.text3} opacity={0.18} />
              </pattern>
              {TOPIC_ORDER.map(t => (
                <linearGradient key={`grad-${t}`} id={`ttv-grad-${t}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={TOPIC_COLOR[t]} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={TOPIC_COLOR[t]} stopOpacity={0.10} />
                </linearGradient>
              ))}
            </defs>

            {/* Dot grid */}
            <rect x={0} y={0} width={layout.width} height={layout.height} fill="url(#ttv-dotgrid)" />

            {/* Column headers */}
            {TOPIC_ORDER.map((t) => {
              const bucket = layout.byCol.get(t)!;
              if (bucket.length === 0) return null;
              const x = bucket[0]!.x;
              return (
                <g key={`head-${t}`}>
                  <text
                    x={x}
                    y={32}
                    textAnchor="middle"
                    fontFamily={font.sans}
                    fontWeight={font.weight.bold}
                    fontSize={font.size.xs}
                    fill={TOPIC_COLOR[t]}
                    style={{ letterSpacing: "0.14em", textTransform: "uppercase" }}
                  >
                    {TOPIC_LABEL[t]}
                  </text>
                  <text
                    x={x}
                    y={46}
                    textAnchor="middle"
                    fontFamily={font.sans}
                    fontSize={font.size.xxs}
                    fill={tokenColor.text3}
                  >
                    {bucket.length} commits
                  </text>
                </g>
              );
            })}

            {/* Edges within each column — tapered bezier chain */}
            {TOPIC_ORDER.map(t => {
              const bucket = layout.byCol.get(t)!;
              const color = TOPIC_COLOR[t];
              return bucket.slice(1).map((c, i) => {
                const prev = bucket[i]!;
                const d = taperedBezierPath(prev.x, prev.y + BUBBLE_R, c.x, c.y - BUBBLE_R);
                const isActiveChain =
                  activeId !== null && (prev.idx === activeId || c.idx === activeId);
                return (
                  <path
                    key={`e-${t}-${c.idx}`}
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={isActiveChain ? 1.6 : 1.1}
                    strokeOpacity={isActiveChain ? 0.9 : 0.42}
                    strokeLinecap="round"
                    style={{
                      transition: `stroke-opacity 180ms ease-out, stroke-width 180ms ease-out`,
                      animation: `ttv-edge-in 640ms ${ENTRY_EASE} both`,
                      animationDelay: `${(prev.idx * STAGGER_MS) + 200}ms`,
                      strokeDasharray: 240,
                    }}
                    pointerEvents="none"
                  />
                );
              });
            })}

            {/* Cross-column hover beams — link active bubble's related
             *  files' containing commits in other columns. (Visual cue
             *  only; we draw them to the bubble's color.) */}
            {active && (
              <g pointerEvents="none">
                {layout.all
                  .filter(c =>
                    c.idx !== active.idx &&
                    c.relatedIds.some(r => active.relatedIds.includes(r)),
                  )
                  .slice(0, 6)
                  .map(c => {
                    const d = taperedBezierPath(active.x, active.y, c.x, c.y);
                    return (
                      <path
                        key={`cross-${c.idx}`}
                        d={d}
                        fill="none"
                        stroke={TOPIC_COLOR[active.topic]}
                        strokeWidth={1}
                        strokeOpacity={0.3}
                        strokeDasharray="2 3"
                      />
                    );
                  })}
              </g>
            )}

            {/* Bubbles */}
            {layout.all.map(c => {
              const isActive = c.idx === activeId;
              const dim = activeId !== null && !isActive;
              const color = TOPIC_COLOR[c.topic];

              const groupStyle: CSSProperties = {
                cursor: "pointer",
                transition: `opacity ${transition.base}, transform ${transition.base}`,
                opacity: dim ? 0.32 : 1,
                transformOrigin: `${c.x}px ${c.y}px`,
                transformBox: "fill-box" as const,
                animation: `ttv-bubble-in 420ms ${ENTRY_EASE} both`,
                animationDelay: `${Math.min(c.idx * STAGGER_MS, 720)}ms`,
              };

              return (
                <g
                  key={`b-${c.idx}`}
                  style={groupStyle}
                  onMouseEnter={() => setHoveredId(c.idx)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleSelect(c.idx)}
                >
                  {/* Card background */}
                  <rect
                    x={c.x - BUBBLE_W / 2}
                    y={c.y - BUBBLE_H / 2}
                    width={BUBBLE_W}
                    height={BUBBLE_H}
                    rx={8}
                    fill={tokenColor.bg1}
                    stroke={isActive ? color : tokenColor.border}
                    strokeWidth={isActive ? 1.4 : 1}
                    filter={isActive ? "drop-shadow(0 2px 8px rgba(0,0,0,0.10))" : "drop-shadow(0 1px 2px rgba(0,0,0,0.04))"}
                  />

                  {/* Topic dot */}
                  <circle
                    cx={c.x - BUBBLE_W / 2 + 14}
                    cy={c.y - BUBBLE_H / 2 + 14}
                    r={4}
                    fill={color}
                  />

                  {/* Hover ring */}
                  {isActive && (
                    <circle
                      cx={c.x - BUBBLE_W / 2 + 14}
                      cy={c.y - BUBBLE_H / 2 + 14}
                      r={7}
                      fill="none"
                      stroke={color}
                      strokeOpacity={0.5}
                      strokeWidth={1}
                    />
                  )}

                  {/* Hash */}
                  <text
                    x={c.x - BUBBLE_W / 2 + 24}
                    y={c.y - BUBBLE_H / 2 + 17}
                    fontFamily={font.mono}
                    fontSize={font.size.xxs}
                    fill={tokenColor.text3}
                  >
                    {c.hash}
                  </text>
                  {/* Date */}
                  <text
                    x={c.x + BUBBLE_W / 2 - 10}
                    y={c.y - BUBBLE_H / 2 + 17}
                    textAnchor="end"
                    fontFamily={font.mono}
                    fontSize={font.size.xxs}
                    fill={tokenColor.text3}
                  >
                    {fmtDaysAgo(c.daysAgo)}
                  </text>

                  {/* Message */}
                  <text
                    x={c.x - BUBBLE_W / 2 + 14}
                    y={c.y - BUBBLE_H / 2 + 33}
                    fontFamily={font.sans}
                    fontSize={font.size.xs}
                    fontWeight={font.weight.medium}
                    fill={tokenColor.text0}
                  >
                    {truncate(c.message, 30)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div
          style={{
            flexShrink: 0,
            padding: `${space[2]}px 0`,
            fontSize: font.size.xxs,
            color: tokenColor.text3,
            fontFamily: font.sans,
          }}
        >
          hover: relate files · click: pin trail
        </div>
      </div>

      {/* ── RIGHT: related files panel ─────────────────────────────── */}
      <div style={rightStyle}>
        <div
          style={{
            padding: `${space[3]}px ${space[3]}px ${space[2]}px`,
            borderBottom: `1px solid ${tokenColor.border}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: font.size.xxs,
              color: tokenColor.text3,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: font.weight.bold,
            }}
          >
            Related files
          </div>
          {active ? (
            <>
              <div
                style={{
                  marginTop: 6,
                  fontSize: font.size.sm,
                  fontWeight: font.weight.semibold,
                  color: tokenColor.text0,
                  fontFamily: font.sans,
                  lineHeight: 1.3,
                }}
              >
                {active.message}
              </div>
              <div
                style={{
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: font.mono,
                  fontSize: font.size.xxs,
                  color: tokenColor.text2,
                }}
              >
                <span>{active.hash}</span>
                <span>·</span>
                <span>{fmtDaysAgo(active.daysAgo)}</span>
                <span>·</span>
                <span style={{ color: TOPIC_COLOR[active.topic], fontWeight: font.weight.bold }}>
                  {TOPIC_LABEL[active.topic]}
                </span>
              </div>
            </>
          ) : (
            <div
              style={{
                marginTop: 6,
                fontSize: font.size.xs,
                color: tokenColor.text2,
                lineHeight: 1.5,
              }}
            >
              bubble hover / click으로 관련 파일을 확인하세요.
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            padding: space[2],
          }}
        >
          {active && activeRelated.length === 0 && (
            <div
              style={{
                padding: `${space[3]}px ${space[2]}px`,
                fontSize: font.size.xs,
                color: tokenColor.text2,
              }}
            >
              이 커밋은 별도 파일 변경이 없습니다.
            </div>
          )}
          {activeRelated.map((e, i) => (
            <RelatedRow key={e.id} entity={e} rank={i} onSelect={() => onFocusEntity?.(e.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

// ── Related row ──────────────────────────────────────────────────────

interface RelatedRowProps {
  entity: Entity;
  rank: number;
  onSelect: () => void;
}

function RelatedRow({ entity, rank, onSelect }: RelatedRowProps) {
  const [hovered, setHovered] = useState(false);

  const rowStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: `${space[2]}px ${space[2]}px`,
    borderRadius: radius.sm,
    background: hovered ? tokenColor.hover : "transparent",
    cursor: "pointer",
    transition: `background-color ${transition.fast}`,
    textAlign: "left",
    width: "100%",
    border: "none",
    animation: `ttv-bubble-in 260ms ${ENTRY_EASE} both`,
    animationDelay: `${rank * 32}ms`,
  };

  return (
    <button
      type="button"
      style={rowStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      aria-label={entity.path}
    >
      <div
        style={{
          fontFamily: font.mono,
          fontSize: font.size.xs,
          fontWeight: font.weight.semibold,
          color: tokenColor.text0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {entity.name}
      </div>
      <div
        style={{
          fontFamily: font.mono,
          fontSize: font.size.xxs,
          color: tokenColor.text3,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={entity.path}
      >
        {entity.path}
      </div>
    </button>
  );
}

// ── Legend ────────────────────────────────────────────────────────────

function TopicLegend() {
  const boxStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    fontSize: font.size.xxs,
    color: tokenColor.text2,
    fontFamily: font.sans,
  };
  return (
    <div style={boxStyle}>
      {TOPIC_ORDER.map(t => (
        <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: TOPIC_COLOR[t],
              display: "inline-block",
            }}
          />
          {TOPIC_LABEL[t]}
        </span>
      ))}
    </div>
  );
}

export const ThoughtTrailView = memo(ThoughtTrailViewImpl);
