// TruckFactorView — team-risk dashboard.
// --------------------------------------------------------------------
// Layout: hero number + row of person silhouettes (N filled, remaining
// ghosted), followed by an author contribution treemap-lite where each
// rectangle represents one author sized by the number of files they are
// the unique expert for. Clicking an author silhouette or rectangle
// toggles that author "gone". If the set of gone authors drops >50% of
// files below an expert, a danger banner surfaces.
//
// Reference: Avelino et al. FSE 2016.

import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import {
  color as tokenColor,
  font,
  radius as radiusToken,
  space,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  authorHue,
  hashId,
  mulberry32,
  truckFactor,
} from "../../../shared/analytics/synth-metrics";

export interface TruckFactorViewProps {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;
const COUNTER_MS = 640;

const KEYFRAMES = `
@keyframes tfFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes tfItemIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

const AUTHOR_POOL = ["jo", "kim", "park", "lee", "song", "han", "yoon", "choi", "an", "ko"] as const;

interface AuthorExpertise {
  id: string;
  files: number;
  share: number;
}

/** Synthesize per-author expert-file counts from the repo root id.
 *  We pick 6..10 authors, then draw file counts from a seeded RNG. */
function buildAuthorExpertise(rootId: string, totalFiles: number): AuthorExpertise[] {
  const rng = mulberry32(hashId(`${rootId}:tf-authors`));
  const n = 6 + Math.floor(rng() * 5); // 6..10
  const weights: number[] = [];
  for (let i = 0; i < n; i++) {
    // Power-law shape — a few experts hold many files, a long tail
    // of minor contributors.
    weights.push(Math.pow(rng(), 1.8) * (i === 0 ? 2.4 : 1));
  }
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const authors: AuthorExpertise[] = [];
  let assigned = 0;
  for (let i = 0; i < n; i++) {
    const share = (weights[i] ?? 0) / total;
    const files = Math.max(1, Math.round(share * totalFiles));
    assigned += files;
    authors.push({
      id: AUTHOR_POOL[i % AUTHOR_POOL.length] ?? `dev${i}`,
      files,
      share,
    });
  }
  // Fix rounding drift so the sum exactly matches totalFiles.
  if (authors.length > 0 && authors[0]) {
    authors[0].files = Math.max(1, authors[0].files + (totalFiles - assigned));
  }
  authors.sort((a, b) => b.files - a.files);
  const sum = authors.reduce((a, b) => a + b.files, 0) || 1;
  for (const a of authors) a.share = a.files / sum;
  return authors;
}

/** Shortest-column masonry packer for author rectangles. */
function packAuthorTreemap(
  authors: AuthorExpertise[],
  totalFiles: number,
  w: number,
  h: number,
): Array<{ author: AuthorExpertise; x: number; y: number; w: number; h: number }> {
  if (authors.length === 0 || w <= 0 || h <= 0) return [];
  const area = w * h;
  const unit = area / Math.max(1, totalFiles);
  // Squarified-ish: place in descending order, current row accumulates
  // until ratio worsens, then flush.
  const out: Array<{ author: AuthorExpertise; x: number; y: number; w: number; h: number }> = [];
  let x = 0;
  let y = 0;
  let remainW = w;
  let remainH = h;
  let i = 0;
  while (i < authors.length) {
    const horizontal = remainW >= remainH;
    const sideLen = horizontal ? remainH : remainW;
    // Pull authors until the row/col is reasonably squarish.
    let rowArea = 0;
    let j = i;
    let bestRatio = Infinity;
    let bestCount = 1;
    while (j < authors.length) {
      rowArea += (authors[j]?.files ?? 0) * unit;
      const count = j - i + 1;
      const side = rowArea / sideLen;
      // Worst-case aspect ratio in the row.
      let worst = 0;
      let cursor = 0;
      for (let k = i; k <= j; k++) {
        const aArea = (authors[k]?.files ?? 0) * unit;
        const aLen = aArea / Math.max(1e-6, side);
        const r = Math.max(aLen / side, side / Math.max(1e-6, aLen));
        if (r > worst) worst = r;
        cursor += aLen;
        void cursor;
      }
      if (worst < bestRatio || count === 1) {
        bestRatio = worst;
        bestCount = count;
        j++;
      } else {
        break;
      }
    }
    // Flush [i, i+bestCount).
    let rowSum = 0;
    for (let k = i; k < i + bestCount; k++) rowSum += (authors[k]?.files ?? 0) * unit;
    const rowSide = rowSum / sideLen;
    if (horizontal) {
      // Row of width rowSide, stacked along remainH.
      let cursor = y;
      for (let k = i; k < i + bestCount; k++) {
        const a = authors[k];
        if (!a) continue;
        const aArea = a.files * unit;
        const hh = aArea / Math.max(1e-6, rowSide);
        out.push({ author: a, x, y: cursor, w: rowSide, h: hh });
        cursor += hh;
      }
      x += rowSide;
      remainW -= rowSide;
    } else {
      let cursor = x;
      for (let k = i; k < i + bestCount; k++) {
        const a = authors[k];
        if (!a) continue;
        const aArea = a.files * unit;
        const ww = aArea / Math.max(1e-6, rowSide);
        out.push({ author: a, x: cursor, y, w: ww, h: rowSide });
        cursor += ww;
      }
      y += rowSide;
      remainH -= rowSide;
    }
    i += bestCount;
  }
  return out;
}

/** rAF-driven integer counter from 0 → target over durationMs. */
function useCounter(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function TruckFactorViewImpl({ ctx }: TruckFactorViewProps): ReactElement | null {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);
  const [goneIds, setGoneIds] = useState<ReadonlySet<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { totalFiles, tf, authors, rootId } = useMemo(() => {
    const tree = ctx.tree;
    const rootId = tree?.rootId ?? "root";
    let totalFiles = 0;
    if (tree) {
      for (const e of tree.byId.values()) {
        if (e.kind === "building") totalFiles++;
      }
    }
    const tf = truckFactor(totalFiles);
    const authors = buildAuthorExpertise(rootId, Math.max(10, totalFiles));
    return { totalFiles, tf, authors, rootId };
  }, [ctx.tree]);

  // Toggle expert "gone" and evaluate whether >50% of files lose coverage.
  const goneFiles = useMemo(() => {
    let sum = 0;
    for (const a of authors) if (goneIds.has(a.id)) sum += a.files;
    return sum;
  }, [authors, goneIds]);

  const effectiveTotal = authors.reduce((a, b) => a + b.files, 0) || 1;
  const goneRatio = goneFiles / effectiveTotal;
  const breached = goneRatio > 0.5;

  const counterValue = useCounter(tf, COUNTER_MS);
  const tfDisplay = Math.round(counterValue);

  if (!ctx.tree || totalFiles === 0) {
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
        데이터가 아직 없어요
      </div>
    );
  }

  const rootStyle: CSSProperties = {
    animation: `tfFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center top",
    padding: "40px 48px 32px 48px",
    boxSizing: "border-box",
    height: "100%",
    overflowY: "auto",
  };

  // Silhouettes — render tf filled + (max(8, tf+2) - tf) ghosted.
  const silhouetteCount = Math.max(8, tf + 3);
  const silhouettes: Array<{ i: number; filled: boolean }> = [];
  for (let i = 0; i < silhouetteCount; i++) silhouettes.push({ i, filled: i < tf });

  // Treemap area.
  const treemapW = Math.max(120, width - 96);
  const treemapH = 260;
  const rects = packAuthorTreemap(authors, effectiveTotal, treemapW, treemapH);

  const toggleGone = (id: string): void => {
    setGoneIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        fontFamily: font.sans,
        color: tokenColor.text0,
        position: "relative",
      }}
    >
      <style>{KEYFRAMES}</style>
      <div style={rootStyle}>
        {/* Header */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: font.size.xxl,
              fontWeight: font.weight.bold,
              color: tokenColor.text0,
              letterSpacing: font.letter.tight,
            }}
          >
            Truck Factor
          </div>
          <div
            style={{
              fontSize: font.size.xs,
              color: tokenColor.text2,
              marginTop: 4,
            }}
          >
            파일별 유일 전문가 집계 — Avelino FSE 2016
          </div>
        </div>

        {/* Hero */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: space[4],
            padding: `${space[4]}px 0`,
            borderBottom: `1px solid ${tokenColor.borderSoft}`,
            marginBottom: space[4],
          }}
        >
          <div
            style={{
              fontSize: 72,
              lineHeight: 1,
              fontWeight: font.weight.bold,
              color: breached ? tokenColor.danger : tokenColor.text0,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: font.letter.tight,
              transition: "color 180ms ease-out",
            }}
          >
            {tfDisplay}
          </div>
          <div
            style={{
              fontSize: font.size.lg,
              color: tokenColor.text1,
              fontWeight: font.weight.medium,
            }}
          >
            Truck Factor = {tf}
          </div>
          <div
            style={{
              fontSize: font.size.xs,
              color: tokenColor.text2,
              marginLeft: "auto",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {totalFiles} files · {authors.length} experts
          </div>
        </div>

        {/* Silhouettes row */}
        <div style={{ marginBottom: space[4] }}>
          <div
            style={{
              fontSize: font.size.xxs,
              color: tokenColor.text2,
              textTransform: "uppercase",
              letterSpacing: font.letter.ultra,
              marginBottom: space[2],
            }}
          >
            Critical experts
          </div>
          <div
            style={{
              display: "flex",
              gap: space[2],
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {silhouettes.map(s => {
              const filled = s.filled;
              return (
                <div
                  key={s.i}
                  aria-hidden
                  style={{
                    animation: `tfItemIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${Math.min(s.i * STAGGER_MS, 400)}ms`,
                  }}
                >
                  <svg width={28} height={38} viewBox="0 0 28 38">
                    <circle
                      cx={14}
                      cy={9}
                      r={6}
                      fill={filled ? tokenColor.text0 : "none"}
                      stroke={tokenColor.text2}
                      strokeWidth={1.2}
                      opacity={filled ? 1 : 0.35}
                    />
                    <path
                      d="M 4 36 C 4 24, 10 18, 14 18 C 18 18, 24 24, 24 36 Z"
                      fill={filled ? tokenColor.text0 : "none"}
                      stroke={tokenColor.text2}
                      strokeWidth={1.2}
                      opacity={filled ? 1 : 0.35}
                    />
                  </svg>
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: space[2],
              fontSize: font.size.xs,
              color: tokenColor.text2,
            }}
          >
            최소 {tf}명이 동시에 이탈해야 유지보수 대란 — 실선 {tf} · 점선 {silhouetteCount - tf} (여유 팀원)
          </div>
        </div>

        {/* Gone-breach banner */}
        <div
          style={{
            padding: `${space[2]}px ${space[3]}px`,
            borderRadius: radiusToken.md,
            background: breached ? "rgba(229, 72, 77, 0.10)" : tokenColor.bg2,
            border: `1px solid ${breached ? tokenColor.danger : tokenColor.border}`,
            color: breached ? tokenColor.danger : tokenColor.text2,
            fontSize: font.size.xs,
            fontWeight: breached ? font.weight.semibold : font.weight.regular,
            marginBottom: space[4],
            transition: "all 180ms ease-out",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {breached
            ? `경고: ${goneIds.size}명 이탈 · ${Math.round(goneRatio * 100)}% 파일 전문가 공백 — 50% 임계치 초과`
            : goneIds.size > 0
              ? `${goneIds.size}명 이탈 시뮬레이션 · ${Math.round(goneRatio * 100)}% 파일 영향 (임계치 이하)`
              : "저자 블록을 클릭해 '나갔을 때' 시뮬레이션 — 파일 커버리지 손실을 측정합니다"}
        </div>

        {/* Author treemap */}
        <div style={{ marginBottom: space[4] }}>
          <div
            style={{
              fontSize: font.size.xxs,
              color: tokenColor.text2,
              textTransform: "uppercase",
              letterSpacing: font.letter.ultra,
              marginBottom: space[2],
            }}
          >
            Expert ownership (click to simulate leaving)
          </div>
          <div
            style={{
              position: "relative",
              width: treemapW,
              height: treemapH,
              background: tokenColor.bg2,
              borderRadius: radiusToken.md,
              border: `1px solid ${tokenColor.border}`,
              overflow: "hidden",
            }}
          >
            {rects.map((r, i) => {
              const gone = goneIds.has(r.author.id);
              const hovered = hoveredId === r.author.id;
              const hue = authorHue(r.author.id);
              const fill = gone
                ? tokenColor.bg3
                : `hsl(${hue} 62% ${hovered ? 58 : 66}%)`;
              const label = `${r.author.id} · ${r.author.files}`;
              const showLabel = r.w > 58 && r.h > 28;
              return (
                <div
                  key={r.author.id}
                  onMouseEnter={() => setHoveredId(r.author.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => toggleGone(r.author.id)}
                  role="button"
                  tabIndex={0}
                  style={{
                    position: "absolute",
                    left: r.x,
                    top: r.y,
                    width: Math.max(0, r.w - 1),
                    height: Math.max(0, r.h - 1),
                    background: fill,
                    border: gone
                      ? `1px dashed ${tokenColor.danger}`
                      : `1px solid ${tokenColor.bg0}`,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: gone ? tokenColor.text3 : tokenColor.text0,
                    fontSize: font.size.xs,
                    fontWeight: font.weight.semibold,
                    padding: 4,
                    overflow: "hidden",
                    textAlign: "center",
                    animation: `tfItemIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${Math.min(i * STAGGER_MS, 500)}ms`,
                    transition: "background 180ms ease-out, opacity 180ms ease-out",
                    opacity: gone ? 0.55 : 1,
                    textDecoration: gone ? "line-through" : "none",
                  }}
                  title={`${r.author.id} — ${r.author.files} files (${Math.round(r.author.share * 100)}%)`}
                >
                  {showLabel ? label : ""}
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: space[2],
              fontSize: font.size.xxs,
              color: tokenColor.text3,
            }}
          >
            rect area ∝ 파일 수 · click → 이탈 시뮬레이션 · seed: {rootId.slice(0, 10)}
          </div>
        </div>
      </div>
    </div>
  );
}

export const TruckFactorView = memo(TruckFactorViewImpl);
