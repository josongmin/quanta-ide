// TestPyramidView — Mike Cohn test pyramid diagnostic.
// --------------------------------------------------------------------
// Left: actual pyramid rendered as three stacked trapezoids (base =
// unit, middle = integration, apex = e2e). Widths are proportional to
// the `testPyramid(rootId)` ratios. Overlaid as a ghost outline is the
// "ideal" 60 / 30 / 10 Cohn pyramid for visual comparison. Shape
// classification is printed below (Healthy / Inverted / Diamond / Ice
// Cream Cone).
//
// Right: per-file test ratio — the 20 worst-tested source files
// (lowest `testRatio`), ranked with horizontal bars.
//
// Reference: Cohn, "Succeeding with Agile" (2009); Fowler's testing
// pyramid.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import {
  color as tokenColor,
  font,
  radius,
  space,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { testPyramid, testRatio } from "../../../shared/analytics/synth-metrics";

export interface TestPyramidViewProps {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;

const KEYFRAMES = `
@keyframes pyrFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes pyrBarGrow {
  from { transform: scaleX(0); opacity: 0; }
  to   { transform: scaleX(1); opacity: 1; }
}
`;

const IDEAL = { unit: 0.6, integration: 0.3, e2e: 0.1 } as const;

interface FileRow {
  id: string;
  name: string;
  path: string;
  ratio: number;
}

type Shape = "Healthy" | "Inverted" | "Diamond" | "Ice Cream Cone";

function classify(p: { unit: number; integration: number; e2e: number }): {
  shape: Shape;
  color: string;
  note: string;
} {
  const { unit, integration, e2e } = p;
  // Inverted — e2e dominates over unit.
  if (e2e > unit) {
    return {
      shape: "Inverted",
      color: tokenColor.danger,
      note: "e2e가 unit보다 많음 — 빌드 느림 + 깨짐 쉬움",
    };
  }
  // Ice Cream Cone — top-heavy with tiny unit base.
  if (unit < 0.35 && e2e > 0.18) {
    return {
      shape: "Ice Cream Cone",
      color: tokenColor.danger,
      note: "상단 비대 — CI 시간 급증, 유닛 부족",
    };
  }
  // Diamond — middle (integration) dominates.
  if (integration > unit && integration > e2e) {
    return {
      shape: "Diamond",
      color: tokenColor.warn,
      note: "integration 비대 — 유닛 쪼개면 빨라짐",
    };
  }
  return {
    shape: "Healthy",
    color: tokenColor.success,
    note: "기준 60/30/10에 근접 — 건강한 피라미드",
  };
}

function TestPyramidViewImpl({
  ctx,
}: TestPyramidViewProps): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const ratios = useMemo(
    () => testPyramid(ctx.tree?.rootId ?? null),
    [ctx.tree?.rootId],
  );

  const rows = useMemo<FileRow[]>(() => {
    if (!ctx.tree) return [];
    const out: FileRow[] = [];
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      // Skip test files themselves — interesting set is under-tested sources.
      if (/\.test\.|\.spec\.|__tests__/.test(e.path)) continue;
      out.push({
        id: e.id,
        name: e.name,
        path: e.path,
        ratio: testRatio(e),
      });
    }
    out.sort((a, b) => a.ratio - b.ratio);
    return out;
  }, [ctx.tree]);

  if (!ctx.tree) {
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
        로딩 중
      </div>
    );
  }

  const verdict = classify(ratios);
  const worstRows = rows.slice(0, 20);

  const PAD = 32;
  const leftPaneFrac = 0.52;
  const leftW = Math.max(320, (width - PAD * 2) * leftPaneFrac);
  const rightW = Math.max(220, width - PAD * 2 - leftW - space[5]);

  // Pyramid geometry.
  const pyrX = PAD + space[4];
  const pyrW = Math.max(160, leftW - space[4] * 2);
  const pyrYTop = PAD + 110;
  const pyrH = Math.max(220, height - pyrYTop - PAD - 170);
  const pyrBottom = pyrYTop + pyrH;

  // Helper to build a single trapezoid layer.
  const layers = [
    { id: "unit", label: "Unit", value: ratios.unit, ideal: IDEAL.unit, color: tokenColor.success },
    {
      id: "integration",
      label: "Integration",
      value: ratios.integration,
      ideal: IDEAL.integration,
      color: tokenColor.warn,
    },
    { id: "e2e", label: "E2E", value: ratios.e2e, ideal: IDEAL.e2e, color: tokenColor.danger },
  ] as const;

  // Allocate y-space as fixed thirds so the pyramid always reads as three
  // stacked tiers (widths carry the proportion signal, not heights).
  const layerHeight = pyrH / 3;

  // Widths at each y — we taper linearly from base to apex. Base width
  // reflects the unit ratio, apex width reflects the e2e ratio.
  function widthAtTier(tierIdx: number, ratio: number): number {
    // Base of pyramid (tier 0) gets full pyrW; successively narrower.
    // We scale each tier's width by its ratio / maxRatio so proportions
    // remain visible while keeping pyramid shape.
    const maxRatio = Math.max(layers[0]!.value, layers[1]!.value, layers[2]!.value, 0.0001);
    const scale = ratio / maxRatio;
    const shape = (3 - tierIdx) / 3; // 1.0, 0.667, 0.333
    return pyrW * Math.max(0.12, shape * (0.4 + 0.6 * scale));
  }

  // Pyramid base = unit, middle = integration, apex = e2e.
  const tiers = [
    { ...layers[0], fromBase: 0 }, // unit (base)
    { ...layers[1], fromBase: 1 },
    { ...layers[2], fromBase: 2 }, // e2e (apex)
  ];

  function tierRect(tierFromBase: number, value: number, ideal: number) {
    const yBottom = pyrBottom - tierFromBase * layerHeight;
    const yTop = yBottom - layerHeight;
    // Widths at bottom + top of this tier.
    const wBottom = widthAtTier(tierFromBase, value);
    const wTop = widthAtTier(tierFromBase + 1, value);
    const cx = pyrX + pyrW / 2;
    const bl = { x: cx - wBottom / 2, y: yBottom };
    const br = { x: cx + wBottom / 2, y: yBottom };
    const tr = { x: cx + wTop / 2, y: yTop };
    const tl = { x: cx - wTop / 2, y: yTop };
    const actual = `M ${bl.x} ${bl.y} L ${br.x} ${br.y} L ${tr.x} ${tr.y} L ${tl.x} ${tl.y} Z`;

    // Ideal ghost outline — same tier, but width derived from ideal ratios.
    const maxIdeal = Math.max(IDEAL.unit, IDEAL.integration, IDEAL.e2e);
    const scaleI = ideal / maxIdeal;
    const shapeBottom = (3 - tierFromBase) / 3;
    const shapeTop = (3 - (tierFromBase + 1)) / 3;
    const wbI = pyrW * Math.max(0.12, shapeBottom * (0.4 + 0.6 * scaleI));
    const wtI = pyrW * Math.max(0.0, shapeTop * (0.4 + 0.6 * scaleI));
    const iBl = { x: cx - wbI / 2, y: yBottom };
    const iBr = { x: cx + wbI / 2, y: yBottom };
    const iTr = { x: cx + wtI / 2, y: yTop };
    const iTl = { x: cx - wtI / 2, y: yTop };
    const ideals = `M ${iBl.x} ${iBl.y} L ${iBr.x} ${iBr.y} L ${iTr.x} ${iTr.y} L ${iTl.x} ${iTl.y} Z`;

    return { actual, ideals, yMid: (yBottom + yTop) / 2, cx };
  }

  const rootStyle: CSSProperties = {
    animation: `pyrFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center top",
  };

  const worstMax = Math.max(0.01, ...worstRows.map(r => Math.max(0.04, r.ratio)));
  const worstRowH = 22;
  const barLabelW = 140;
  const barValueW = 48;

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        fontFamily: font.sans,
      }}
    >
      <style>{KEYFRAMES}</style>
      <div
        style={{
          ...rootStyle,
          position: "absolute",
          inset: 0,
          boxSizing: "border-box",
          padding: PAD,
          display: "flex",
          gap: space[5],
        }}
      >
        {/* Left pane — pyramid */}
        <div
          style={{
            width: leftW,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: space[3],
          }}
        >
          <div>
            <div
              style={{
                color: tokenColor.text0,
                fontSize: font.size.display,
                fontWeight: font.weight.semibold,
                letterSpacing: font.letter.tight,
              }}
            >
              Test Pyramid
            </div>
            <div
              style={{
                color: tokenColor.text2,
                fontSize: font.size.xs,
                marginTop: 4,
              }}
            >
              테스트 전략 건강도 — Cohn 2009 / Fowler
            </div>
          </div>

          <svg
            width="100%"
            height={pyrH + 80}
            viewBox={`0 0 ${pyrX + pyrW + space[4]} ${pyrH + 80}`}
            preserveAspectRatio="xMidYMin meet"
            role="img"
            aria-label="Test pyramid shape"
            style={{ display: "block" }}
          >
            {/* Pyramid tiers */}
            {tiers.map((t, i) => {
              const r = tierRect(t.fromBase, t.value, t.ideal);
              return (
                <g
                  key={t.id}
                  style={{
                    animation: `pyrFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${100 + i * 80}ms`,
                  }}
                >
                  {/* Ideal ghost */}
                  <path
                    d={r.ideals}
                    fill="none"
                    stroke={tokenColor.borderStrong}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    opacity={0.7}
                  />
                  {/* Actual fill */}
                  <path
                    d={r.actual}
                    fill={t.color}
                    fillOpacity={0.6}
                    stroke={t.color}
                    strokeWidth={1.2}
                  />
                  {/* Layer label */}
                  <text
                    x={r.cx}
                    y={r.yMid + 4}
                    textAnchor="middle"
                    fill={tokenColor.text0}
                    fontSize={font.size.sm}
                    fontFamily={font.sans}
                    fontWeight={font.weight.semibold}
                  >
                    {t.label}
                  </text>
                  <text
                    x={r.cx}
                    y={r.yMid + 18}
                    textAnchor="middle"
                    fill={tokenColor.text1}
                    fontSize={font.size.xs}
                    fontFamily={font.mono}
                  >
                    {`${Math.round(t.value * 100)}%  (ideal ${Math.round(
                      t.ideal * 100,
                    )}%)`}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Verdict card */}
          <div
            style={{
              padding: `${space[3]}px ${space[4]}px`,
              background: tokenColor.bg2,
              border: `1px solid ${tokenColor.border}`,
              borderRadius: radius.md,
              display: "flex",
              alignItems: "center",
              gap: space[4],
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: radius.pill,
                background: verdict.color,
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  color: verdict.color,
                  fontSize: font.size.lg,
                  fontWeight: font.weight.semibold,
                }}
              >
                {verdict.shape}
              </div>
              <div
                style={{
                  color: tokenColor.text2,
                  fontSize: font.size.xs,
                  marginTop: 2,
                }}
              >
                {verdict.note}
              </div>
            </div>
            <div
              style={{
                fontFamily: font.mono,
                color: tokenColor.text2,
                fontSize: font.size.xxs,
                textAlign: "right",
              }}
            >
              {`U ${(ratios.unit * 100).toFixed(0)} · I ${(
                ratios.integration * 100
              ).toFixed(0)} · E ${(ratios.e2e * 100).toFixed(0)}`}
              <div style={{ color: tokenColor.text3 }}>
                ideal 60 / 30 / 10
              </div>
            </div>
          </div>
        </div>

        {/* Right pane — worst-tested files */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: space[2],
          }}
        >
          <div
            style={{
              color: tokenColor.text0,
              fontSize: font.size.lg,
              fontWeight: font.weight.semibold,
              letterSpacing: font.letter.tight,
            }}
          >
            Worst-tested files
          </div>
          <div
            style={{
              color: tokenColor.text2,
              fontSize: font.size.xs,
            }}
          >
            top-{worstRows.length} · 낮은 test/source 비율순
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              border: `1px solid ${tokenColor.border}`,
              borderRadius: radius.md,
              background: tokenColor.bg1,
              padding: `${space[2]}px 0`,
            }}
          >
            {worstRows.length === 0 ? (
              <div
                style={{
                  color: tokenColor.text3,
                  textAlign: "center",
                  padding: space[5],
                  fontSize: font.size.sm,
                }}
              >
                파일 없음
              </div>
            ) : (
              <svg
                width="100%"
                height={worstRows.length * worstRowH + space[2]}
                viewBox={`0 0 ${rightW} ${worstRows.length * worstRowH + space[2]}`}
                preserveAspectRatio="none"
                style={{ display: "block" }}
              >
                {worstRows.map((r, i) => {
                  const y = i * worstRowH + 14;
                  const trackX = barLabelW + 12;
                  const trackW = Math.max(40, rightW - trackX - barValueW - 8);
                  const share = r.ratio / worstMax;
                  const barW = share * trackW;
                  const c =
                    r.ratio < 0.2
                      ? tokenColor.danger
                      : r.ratio < 0.5
                        ? tokenColor.warn
                        : tokenColor.success;
                  const isHovered = hoveredId === r.id;
                  const isSelected = ctx.selectedId === r.id;
                  const dim =
                    hoveredId !== null && !isHovered ? 0.38 : 1;
                  return (
                    <g
                      key={r.id}
                      style={{
                        cursor: "pointer",
                        opacity: dim,
                        transition: "opacity 180ms ease-out",
                        animation: `pyrFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                        animationDelay: `${160 + Math.min(i * STAGGER_MS, 700)}ms`,
                      }}
                      onMouseEnter={() => setHoveredId(r.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => ctx.dispatch.selectEntity(r.id)}
                    >
                      <rect
                        x={4}
                        y={y - 15}
                        width={rightW - 8}
                        height={worstRowH - 2}
                        fill={isSelected ? tokenColor.accentSoft : "transparent"}
                        stroke={isSelected ? tokenColor.accentBorder : "none"}
                        strokeWidth={1}
                        rx={radius.xs}
                      />
                      <text
                        x={12}
                        y={y}
                        fill={tokenColor.text0}
                        fontSize={font.size.sm}
                        fontFamily={font.sans}
                        fontWeight={
                          isSelected
                            ? font.weight.semibold
                            : font.weight.regular
                        }
                      >
                        {r.name.length > 22 ? `${r.name.slice(0, 21)}…` : r.name}
                      </text>
                      <rect
                        x={trackX}
                        y={y - 10}
                        width={trackW}
                        height={10}
                        fill={tokenColor.bg3}
                        rx={radius.xs}
                      />
                      <rect
                        x={trackX}
                        y={y - 10}
                        width={Math.max(1, barW)}
                        height={10}
                        fill={c}
                        opacity={0.9}
                        rx={radius.xs}
                        style={{
                          transformOrigin: `${trackX}px ${y - 5}px`,
                          animation: `pyrBarGrow ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                          animationDelay: `${220 + Math.min(i * STAGGER_MS, 700)}ms`,
                        }}
                      />
                      <text
                        x={trackX + trackW + 6}
                        y={y}
                        fill={tokenColor.text1}
                        fontSize={font.size.xs}
                        fontFamily={font.mono}
                      >
                        {`${Math.round(r.ratio * 100)}%`}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const TestPyramidView = memo(TestPyramidViewImpl);
