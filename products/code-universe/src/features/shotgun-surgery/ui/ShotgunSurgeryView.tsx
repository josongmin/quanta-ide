// ShotgunSurgeryView — cards of blast patterns, one per offender.
// --------------------------------------------------------------------
// A file scores `shotgunSurgeryScore(entity) > 0.5` if a typical change
// to it ends up touching many siblings. Each card visualises that
// pattern:
//
//   - Central hub labelled with the file name.
//   - 5-15 tapered bezier tendrils radiating to synthesised "affected"
//     siblings, picked deterministically from the parent's children.
//   - Hovering a tendril highlights its target pill on the card.
//
// Cards are ranked by total spread (affected count × score). Cards fade
// + scale in with a short per-item stagger so a glance conveys the
// ordering (scariest first, top-left).

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  radius as radiusToken,
  shadow,
  space,
  transition,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  shotgunSurgeryScore,
  seeded,
} from "../../../shared/analytics/synth-metrics";

export interface ShotgunSurgeryViewProps {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 20;

const KEYFRAMES = `
@keyframes ssFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes ssCardIn {
  from { opacity: 0; transform: translateY(6px) scale(0.985); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
`;

interface Affected {
  id: string;
  name: string;
  /** Angle in radians around the hub. */
  theta: number;
  /** 0..1 strength of the co-change link. */
  weight: number;
}

interface BlastCard {
  id: string;
  name: string;
  path: string;
  score: number;
  affected: Affected[];
  spread: number;
}

function ShotgunSurgeryViewImpl({ ctx }: ShotgunSurgeryViewProps): ReactElement | null {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const cards = useMemo<BlastCard[]>(() => {
    if (!ctx.tree) return [];
    const out: BlastCard[] = [];
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      const score = shotgunSurgeryScore(e as Entity);
      if (score <= 0.5) continue;
      const rng = seeded(e.id, "shotgun-count");
      const nAffected = Math.max(
        5,
        Math.min(15, 5 + Math.floor(rng() * 11)),
      );
      const affected = pickAffected(ctx, e as Entity, nAffected);
      if (affected.length === 0) continue;
      out.push({
        id: e.id,
        name: e.name,
        path: e.path,
        score,
        affected,
        spread: affected.length * score,
      });
    }
    out.sort((a, b) => b.spread - a.spread);
    return out.slice(0, 36);
  }, [ctx]);

  if (!ctx.tree || cards.length === 0) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: tokenColor.text3,
          fontFamily: font.sans,
          fontSize: font.size.md,
          background: tokenColor.bg0,
        }}
      >
        <style>{KEYFRAMES}</style>
        Shotgun Surgery 후보가 없어요
      </div>
    );
  }

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        fontFamily: font.sans,
        color: tokenColor.text0,
        animation: `ssFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
        overflowY: "auto",
      }}
    >
      <style>{KEYFRAMES}</style>
      <div
        style={{
          padding: "40px 48px 32px 48px",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: space[6] }}>
          <div
            style={{
              fontSize: font.size.xxl,
              fontWeight: font.weight.bold,
              letterSpacing: font.letter.tight,
            }}
          >
            Shotgun Surgery
          </div>
          <div
            style={{
              fontSize: font.size.xs,
              color: tokenColor.text2,
              marginTop: 4,
            }}
          >
            한 변경이 여러 파일에 흩뿌려지는 blast 패턴 — 총 {cards.length}건
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: space[4],
          }}
        >
          {cards.map((card, i) => (
            <BlastCardView
              key={card.id}
              card={card}
              index={i}
              selected={ctx.selectedId === card.id}
              onSelect={id => ctx.dispatch.selectEntity(id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BlastCardView({
  card,
  index,
  selected,
  onSelect,
}: {
  card: BlastCard;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  // SVG coordinate space: [-100..100] square.
  const hubR = 28;
  const ringR = 80;

  const cardStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: space[3],
    padding: `${space[4]}px ${space[4]}px ${space[3]}px`,
    background: tokenColor.bg1,
    border: `1px solid ${selected ? tokenColor.accentBorder : tokenColor.border}`,
    borderRadius: radiusToken.md,
    boxShadow: selected ? shadow.md : shadow.sm,
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
    outline: "none",
    transition: `border-color ${transition.base}, box-shadow ${transition.base}, transform ${transition.base}`,
    animation: `ssCardIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    animationDelay: `${Math.min(index * STAGGER_MS, 480)}ms`,
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(card.id)}
      style={cardStyle}
      aria-pressed={selected}
    >
      {/* SVG blast */}
      <div style={{ width: "100%", aspectRatio: "1.4 / 1", background: tokenColor.bg2, borderRadius: radiusToken.sm, overflow: "hidden" }}>
        <svg
          viewBox="-100 -72 200 144"
          width="100%"
          height="100%"
          style={{ display: "block" }}
        >
          {/* Soft ring guide */}
          <circle
            cx={0}
            cy={0}
            r={ringR}
            fill="none"
            stroke={tokenColor.border}
            strokeWidth={0.6}
            strokeDasharray="2 3"
          />

          {/* Tapered bezier tendrils */}
          {card.affected.map((a, i) => {
            const x = Math.cos(a.theta) * ringR;
            const y = Math.sin(a.theta) * ringR * 0.72;
            const cxA = Math.cos(a.theta) * hubR * 1.4;
            const cyA = Math.sin(a.theta) * hubR * 1.4 * 0.72;
            const cxB = Math.cos(a.theta) * ringR * 0.6;
            const cyB = Math.sin(a.theta) * ringR * 0.6 * 0.72;
            const active = activeIdx === i;
            const strokeW = 0.9 + a.weight * 1.8;
            return (
              <g key={a.id}>
                <path
                  d={`M ${hubR * Math.cos(a.theta)} ${hubR * Math.sin(a.theta) * 0.72} C ${cxA} ${cyA}, ${cxB} ${cyB}, ${x} ${y}`}
                  fill="none"
                  stroke={active ? tokenColor.accent : tokenColor.danger}
                  strokeOpacity={active ? 0.95 : 0.45 + a.weight * 0.3}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                  style={{ transition: "stroke 180ms ease-out, stroke-opacity 180ms ease-out" }}
                />
                {/* Endpoint dot */}
                <circle
                  cx={x}
                  cy={y}
                  r={active ? 4 : 3}
                  fill={active ? tokenColor.accent : tokenColor.danger}
                  fillOpacity={active ? 1 : 0.7}
                  onMouseEnter={e => {
                    e.stopPropagation();
                    setActiveIdx(i);
                  }}
                  onMouseLeave={e => {
                    e.stopPropagation();
                    setActiveIdx(null);
                  }}
                  style={{ cursor: "pointer" }}
                />
              </g>
            );
          })}

          {/* Hub */}
          <circle
            cx={0}
            cy={0}
            r={hubR}
            fill={tokenColor.bg1}
            stroke={tokenColor.borderStrong}
            strokeWidth={1}
          />
          <circle
            cx={0}
            cy={0}
            r={hubR * 0.5}
            fill={tokenColor.text0}
            fillOpacity={0.82}
          />
        </svg>
      </div>

      {/* Label + score */}
      <div>
        <div
          style={{
            fontSize: font.size.sm,
            fontWeight: font.weight.semibold,
            color: tokenColor.text0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {card.name}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: font.size.xxs,
            color: tokenColor.text3,
            fontFamily: font.mono,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {card.path}
        </div>
        <div
          style={{
            marginTop: space[2],
            display: "flex",
            alignItems: "center",
            gap: space[2],
          }}
        >
          <div
            style={{
              flex: 1,
              height: 4,
              background: tokenColor.bg3,
              borderRadius: radiusToken.pill,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.round(card.score * 100)}%`,
                background: `linear-gradient(90deg, ${tokenColor.warn}, ${tokenColor.danger})`,
                borderRadius: radiusToken.pill,
              }}
            />
          </div>
          <span
            style={{
              fontSize: font.size.xxs,
              color: tokenColor.text2,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {card.affected.length} files · {Math.round(card.score * 100)}
          </span>
        </div>
      </div>

      {/* Affected pills */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: space[1],
        }}
        onClick={e => e.stopPropagation()}
      >
        {card.affected.map((a, i) => {
          const active = activeIdx === i;
          const pillStyle: CSSProperties = {
            fontSize: font.size.xxs,
            fontFamily: font.mono,
            color: active ? tokenColor.accent : tokenColor.text2,
            background: active ? tokenColor.accentSoft : tokenColor.bg3,
            border: `1px solid ${active ? tokenColor.accentBorder : tokenColor.border}`,
            borderRadius: radiusToken.sm,
            padding: "1px 6px",
            cursor: "default",
            transition: `background ${transition.base}, color ${transition.base}, border-color ${transition.base}`,
            maxWidth: 160,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          };
          return (
            <span
              key={a.id}
              style={pillStyle}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(null)}
              title={a.id}
            >
              {a.name}
            </span>
          );
        })}
      </div>
    </button>
  );
}

/** Pick `n` affected siblings by seeded RNG, scatter angles around
 *  the circle with small jitter so each card feels unique. */
function pickAffected(
  ctx: ViewContextValue,
  entity: Entity,
  n: number,
): Affected[] {
  const tree = ctx.tree;
  if (!tree) return [];
  const rng = seeded(entity.id, "shotgun-scatter");
  const parent = entity.parentId ? tree.byId.get(entity.parentId) : null;
  let pool: Entity[] = parent
    ? parent.childIds
        .map(id => tree.byId.get(id))
        .filter((e): e is Entity => !!e && e.id !== entity.id && e.kind === "building")
    : [];
  if (pool.length < n) {
    // Pad with other buildings, stable order (tree.byId iteration order).
    for (const e of tree.byId.values()) {
      if (e.kind !== "building" || e.id === entity.id) continue;
      if (pool.some(p => p.id === e.id)) continue;
      pool.push(e);
      if (pool.length >= Math.max(n * 2, 24)) break;
    }
  }
  if (pool.length === 0) return [];
  // Shuffle by RNG and take first n.
  const shuffled = [...pool]
    .map(e => ({ e, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map(x => x.e);
  const taken = shuffled.slice(0, Math.min(n, shuffled.length));
  const out: Affected[] = [];
  for (let i = 0; i < taken.length; i++) {
    const base = (i / taken.length) * Math.PI * 2;
    const jitter = (rng() - 0.5) * 0.4;
    const weight = 0.35 + rng() * 0.65;
    out.push({
      id: taken[i]!.id,
      name: taken[i]!.name,
      theta: base + jitter,
      weight,
    });
  }
  return out;
}

export const ShotgunSurgeryView = memo(ShotgunSurgeryViewImpl);
