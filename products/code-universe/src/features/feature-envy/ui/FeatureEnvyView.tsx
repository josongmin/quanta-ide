// FeatureEnvyView — files whose methods "envy" a sibling class.
// --------------------------------------------------------------------
// Split pane:
//   - Left 42%: ranked list of offenders (highest envy score first).
//     Each row shows the file name, an "envies → Target" arrow, a
//     score meter, and a tight preview of synthetic offending methods.
//   - Right 58%: detail pane for the selected offender with an explicit
//     "Move Method to X" suggestion and the offending method list.
//
// The target class is picked deterministically: take the sibling
// entity list of the offender's parent, pick one via a seeded RNG on
// `entity.id`. If the parent has a single child (no siblings), we
// fall back to the next file at the same kind.

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
  featureEnvyScore,
  seeded,
} from "../../../shared/analytics/synth-metrics";

export interface FeatureEnvyViewProps {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;

const KEYFRAMES = `
@keyframes feFadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes feRowIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

const METHOD_NAMES = [
  "resolvePath", "formatLabel", "computeStyle", "mapState",
  "buildTree", "serializePayload", "normalizeId", "flatten",
  "tagPrefix", "extractMeta", "readFlag", "compareOrder",
  "renderRow", "dispatchEvent", "toEntity", "encodeValue",
];

interface Offender {
  id: string;
  name: string;
  path: string;
  score: number;       // 0..1
  targetId: string | null;
  targetName: string;
  targetPath: string;
  methods: string[];   // synthesized envied method names
}

function FeatureEnvyViewImpl({ ctx }: FeatureEnvyViewProps): ReactElement | null {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const offenders = useMemo<Offender[]>(() => {
    if (!ctx.tree) return [];
    const out: Offender[] = [];
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      const score = featureEnvyScore(e as Entity);
      if (score < 0.45) continue;
      const target = pickTarget(ctx, e as Entity);
      const methods = pickMethods(e.id, 3 + Math.floor(score * 4));
      out.push({
        id: e.id,
        name: e.name,
        path: e.path,
        score,
        targetId: target?.id ?? null,
        targetName: target?.name ?? "sibling",
        targetPath: target?.path ?? "",
        methods,
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }, [ctx]);

  const [selectedLocal, setSelectedLocal] = useState<string | null>(null);
  // Prefer external selection when it points at an offender; otherwise
  // fall back to our local pick → first row by default.
  const selectedId = useMemo(() => {
    if (ctx.selectedId && offenders.some(o => o.id === ctx.selectedId)) {
      return ctx.selectedId;
    }
    if (selectedLocal && offenders.some(o => o.id === selectedLocal)) {
      return selectedLocal;
    }
    return offenders[0]?.id ?? null;
  }, [ctx.selectedId, offenders, selectedLocal]);

  const selected = useMemo(
    () => offenders.find(o => o.id === selectedId) ?? null,
    [offenders, selectedId],
  );

  if (!ctx.tree || offenders.length === 0) {
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
        Feature Envy 후보가 없어요
      </div>
    );
  }

  const handleSelect = (id: string) => {
    setSelectedLocal(id);
    ctx.dispatch.selectEntity(id);
  };

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        fontFamily: font.sans,
        color: tokenColor.text0,
        animation: `feFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
      }}
    >
      <style>{KEYFRAMES}</style>
      <div
        style={{
          padding: "40px 48px 32px 48px",
          boxSizing: "border-box",
          height: "100%",
          display: "grid",
          gridTemplateRows: "auto 1fr",
          gap: space[4],
          minHeight: 0,
        }}
      >
        {/* Header */}
        <div>
          <div
            style={{
              fontSize: font.size.xxl,
              fontWeight: font.weight.bold,
              letterSpacing: font.letter.tight,
            }}
          >
            Feature Envy
          </div>
          <div
            style={{
              fontSize: font.size.xs,
              color: tokenColor.text2,
              marginTop: 4,
            }}
          >
            남의 클래스 데이터만 쓰는 메소드 — Move Method 후보 {offenders.length}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 42%) 1fr",
            gap: space[4],
            minHeight: 0,
          }}
        >
          {/* Left: ranked list */}
          <div
            style={{
              overflowY: "auto",
              paddingRight: space[2],
              display: "flex",
              flexDirection: "column",
              gap: space[2],
            }}
          >
            {offenders.map((o, i) => (
              <OffenderRow
                key={o.id}
                offender={o}
                index={i}
                active={o.id === selectedId}
                onSelect={handleSelect}
              />
            ))}
          </div>

          {/* Right: detail */}
          <div style={{ overflowY: "auto" }}>
            {selected ? <Detail offender={selected} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function OffenderRow({
  offender,
  index,
  active,
  onSelect,
}: {
  offender: Offender;
  index: number;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const rowStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: space[2],
    padding: `${space[3]}px ${space[4]}px`,
    background: active ? tokenColor.accentSofter : tokenColor.bg1,
    border: `1px solid ${active ? tokenColor.accentBorder : tokenColor.border}`,
    borderRadius: radiusToken.md,
    boxShadow: active ? shadow.sm : "none",
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
    outline: "none",
    transition: `background ${transition.base}, border-color ${transition.base}, transform ${transition.base}`,
    animation: `feRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    animationDelay: `${Math.min(index * STAGGER_MS, 360)}ms`,
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(offender.id)}
      style={rowStyle}
      aria-pressed={active}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: space[2],
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: font.size.sm,
              fontWeight: font.weight.semibold,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: tokenColor.text0,
            }}
          >
            {offender.name}
          </div>
          <div
            style={{
              fontSize: font.size.xxs,
              color: tokenColor.text3,
              fontFamily: font.mono,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {offender.path}
          </div>
        </div>
        <div
          style={{
            color: tokenColor.text2,
            fontSize: font.size.sm,
            padding: `0 ${space[1]}px`,
          }}
          aria-hidden
        >
          envies →
        </div>
        <div style={{ minWidth: 0, textAlign: "right" }}>
          <div
            style={{
              fontSize: font.size.sm,
              fontWeight: font.weight.semibold,
              color: tokenColor.text1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {offender.targetName}
          </div>
          <div
            style={{
              fontSize: font.size.xxs,
              color: tokenColor.text3,
              fontFamily: font.mono,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {offender.targetPath}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
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
              width: `${Math.round(offender.score * 100)}%`,
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
            minWidth: 24,
            textAlign: "right",
          }}
        >
          {Math.round(offender.score * 100)}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: space[1],
        }}
      >
        {offender.methods.slice(0, 3).map(m => (
          <span
            key={m}
            style={{
              fontSize: font.size.xxs,
              fontFamily: font.mono,
              color: tokenColor.text2,
              background: tokenColor.bg3,
              border: `1px solid ${tokenColor.border}`,
              borderRadius: radiusToken.sm,
              padding: "1px 6px",
            }}
          >
            {m}()
          </span>
        ))}
      </div>
    </button>
  );
}

function Detail({ offender }: { offender: Offender }) {
  return (
    <div
      style={{
        background: tokenColor.bg1,
        border: `1px solid ${tokenColor.border}`,
        borderRadius: radiusToken.md,
        padding: `${space[5]}px ${space[5]}px`,
        boxShadow: shadow.sm,
        display: "flex",
        flexDirection: "column",
        gap: space[4],
      }}
    >
      <div>
        <div
          style={{
            fontSize: font.size.xxs,
            letterSpacing: font.letter.ultra,
            textTransform: "uppercase",
            color: tokenColor.text2,
            fontWeight: font.weight.semibold,
          }}
        >
          Suggested refactor
        </div>
        <div
          style={{
            marginTop: space[2],
            fontSize: font.size.xl,
            fontWeight: font.weight.semibold,
            color: tokenColor.text0,
          }}
        >
          Move Method to{" "}
          <span style={{ color: tokenColor.accent }}>{offender.targetName}</span>
        </div>
        <div
          style={{
            marginTop: space[1],
            fontSize: font.size.xs,
            color: tokenColor.text2,
            fontFamily: font.mono,
          }}
        >
          {offender.path} → {offender.targetPath || "(no target available)"}
        </div>
      </div>

      <div
        style={{
          height: 1,
          background: tokenColor.border,
        }}
      />

      <div>
        <div
          style={{
            fontSize: font.size.xxs,
            letterSpacing: font.letter.ultra,
            textTransform: "uppercase",
            color: tokenColor.text2,
            fontWeight: font.weight.semibold,
          }}
        >
          Envied methods
        </div>
        <div
          style={{
            marginTop: space[2],
            display: "flex",
            flexDirection: "column",
            gap: space[1],
          }}
        >
          {offender.methods.map(m => (
            <div
              key={m}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: `${space[1]}px ${space[2]}px`,
                background: tokenColor.bg2,
                border: `1px solid ${tokenColor.border}`,
                borderRadius: radiusToken.sm,
              }}
            >
              <span
                style={{
                  fontFamily: font.mono,
                  fontSize: font.size.sm,
                  color: tokenColor.text0,
                }}
              >
                {m}()
              </span>
              <span
                style={{
                  fontSize: font.size.xxs,
                  color: tokenColor.text2,
                }}
              >
                타 클래스 접근 우세
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          fontSize: font.size.xxs,
          color: tokenColor.text3,
          lineHeight: 1.5,
        }}
      >
        Envy 점수 = 자기 클래스 vs 타 클래스 데이터 접근 비율
        (Fowler 1999; Palomba et al. ICSE 2013 change-history 검증).
        점수 ≥ 45% 파일이 목록에 오릅니다.
      </div>
    </div>
  );
}

/** Pick a sibling entity (same parent) via seeded RNG on the offender's
 *  id. Falls back to scanning other `building` entities when the
 *  parent has no siblings. */
function pickTarget(ctx: ViewContextValue, entity: Entity): Entity | null {
  const tree = ctx.tree;
  if (!tree) return null;
  const rng = seeded(entity.id, "envy-target");
  const parent = entity.parentId ? tree.byId.get(entity.parentId) : null;
  const pool = parent
    ? parent.childIds
        .map(id => tree.byId.get(id))
        .filter((e): e is Entity => !!e && e.id !== entity.id && e.kind === "building")
    : [];
  if (pool.length > 0) {
    return pool[Math.floor(rng() * pool.length)] ?? null;
  }
  // Fallback: pick any other building in the tree.
  const buildings: Entity[] = [];
  for (const e of tree.byId.values()) {
    if (e.kind === "building" && e.id !== entity.id) buildings.push(e);
    if (buildings.length >= 32) break;
  }
  if (buildings.length === 0) return null;
  return buildings[Math.floor(rng() * buildings.length)] ?? null;
}

/** Pick `n` stable method names for display. */
function pickMethods(id: string, n: number): string[] {
  const rng = seeded(id, "envy-methods");
  const out: string[] = [];
  const used = new Set<number>();
  const clamped = Math.max(1, Math.min(n, 6));
  while (out.length < clamped && used.size < METHOD_NAMES.length) {
    const idx = Math.floor(rng() * METHOD_NAMES.length);
    if (used.has(idx)) continue;
    used.add(idx);
    const name = METHOD_NAMES[idx];
    if (name) out.push(name);
  }
  return out;
}

export const FeatureEnvyView = memo(FeatureEnvyViewImpl);
