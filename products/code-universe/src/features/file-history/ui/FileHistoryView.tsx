// FileHistoryView — one-file git log visualization.
// --------------------------------------------------------------------
// Reference: Voinea & Telea (VISSOFT 2006) + Lanza/Ducasse CodeMap.
// Three horizontal bands:
//   (1) LoC growth line chart over 365d. Derived from commit density
//       via a seeded random walk so the line drifts in a plausible but
//       deterministic way. The current LoC (entity.metrics.loc) is
//       pinned at the right edge to anchor reality.
//   (2) Commit dots on a 365d time axis. Each dot is tinted by primary
//       author hue (HSL) and sized ∝ seeded lines-changed.
//   (3) Blame rainbow: every line of the current file colored by
//       primary author. We use the file's authorSplit as a weighted
//       band distribution so the rainbow mirrors ownership share.

import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import {
  authorHue,
  authorSplit,
  commitHistory,
  hashId,
  primaryAuthor,
  recentCommits,
  seeded,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const KEYFRAMES = `
@keyframes fh-enter {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes fh-line {
  from { stroke-dashoffset: var(--fh-dash); }
  to   { stroke-dashoffset: 0; }
}
@keyframes fh-dot {
  from { opacity: 0; transform: scale(0.5); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes fh-stripe {
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
}
`;

const DAYS = 365;
const DAY_MS = 86400_000;

function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

function FileHistoryViewImpl({ ctx, entity, empty }: Props): ReactElement {
  const data = useMemo(() => {
    if (!entity) return null;
    const commits = commitHistory(entity, DAYS);
    const split = authorSplit(entity);
    const primary = primaryAuthor(entity);
    const recent = recentCommits(entity);
    return { commits, split, primary, recent };
  }, [entity]);

  const locSeries = useMemo(() => {
    if (!entity) return [] as number[];
    // Seeded LoC-over-time: we know the final LoC (entity.metrics.loc) at
    // t=now. Walk backward with a seeded drift per sampling bucket so the
    // curve is deterministic and reproducible.
    const finalLoc = Math.max(40, entity.metrics?.loc ?? 180);
    const buckets = 64;
    const rng = seeded(entity.id, "loc-walk");
    const vals: number[] = new Array(buckets);
    vals[buckets - 1] = finalLoc;
    for (let i = buckets - 2; i >= 0; i--) {
      const prev = vals[i + 1]!;
      // Larger drift earlier so the start value is further from final;
      // damped near the end to anchor reality.
      const strength = 0.06 + (1 - i / buckets) * 0.12;
      const delta = (rng() - 0.42) * prev * strength;
      vals[i] = Math.max(12, Math.round(prev - delta));
    }
    return vals;
  }, [entity]);

  // Blame rainbow band — # lines equal to final LoC but capped for
  // rendering economy.
  const lineCount = Math.min(240, Math.max(24, entity?.metrics?.loc ?? 120));
  const rainbow = useMemo(() => {
    if (!entity || !data) return [] as { author: string; hue: number }[];
    const shares = data.split;
    const out: { author: string; hue: number }[] = [];
    // Distribute lines in author-share proportion, with a small per-line
    // jitter so the edges aren't razor-straight (real blame is messy).
    let acc = 0;
    const sorted = [...shares].sort((a, b) => b.share - a.share);
    for (const s of sorted) {
      const span = Math.round(s.share * lineCount);
      for (let i = 0; i < span && acc + i < lineCount; i++) {
        // Occasional "author switch" in the middle of a band for realism.
        const flip = seeded(`${entity.id}::blame-${acc + i}`, "f")() < 0.06;
        const who = flip
          ? sorted[(sorted.indexOf(s) + 1) % sorted.length]!.id
          : s.id;
        out.push({ author: who, hue: authorHue(who) });
      }
      acc += span;
    }
    // Pad tail if rounding left a gap.
    while (out.length < lineCount) {
      const tail = sorted[sorted.length - 1]!;
      out.push({ author: tail.id, hue: authorHue(tail.id) });
    }
    return out;
  }, [data, entity, lineCount]);

  if (empty || !entity || !data) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하세요.</div>
      </div>
    );
  }

  const w = Math.max(640, ctx.viewportSize.w - space[6] * 2);
  const bandPad = space[5];

  // Line chart geometry
  const lcH = 120;
  const lcInnerW = w - bandPad * 2;
  const minLoc = locSeries.length > 0 ? Math.min(...locSeries) : 0;
  const maxLoc = locSeries.length > 0 ? Math.max(...locSeries) : 1;
  const locRange = Math.max(1, maxLoc - minLoc);
  const linePts = locSeries.map((v, i) => {
    const x = (i / Math.max(1, locSeries.length - 1)) * lcInnerW;
    const y = lcH - ((v - minLoc) / locRange) * (lcH - 16) - 4;
    return [x, y] as const;
  });
  const linePath = linePts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L ${lcInnerW.toFixed(2)} ${lcH} L 0 ${lcH} Z`;
  // Measure approximate path length for dashoffset entrance
  const approxLen = Math.ceil(locSeries.length * 10 + lcInnerW);

  // Commit-dot band geometry
  const cbH = 76;
  const now = Date.now();
  const dotBandStart = now - DAYS * DAY_MS;
  const rbH = 44;

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      {/* Header */}
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>FileLog · <span style={fileNameStyle}>{entity.name}</span></div>
          <div style={subtitleStyle}>
            {entity.path} · {data.commits.length} commits in {DAYS}d · primary @{data.primary}
          </div>
        </div>
        <div style={{ display: "flex", gap: space[2] }}>
          <span style={pillStyle}>{data.recent} recent</span>
          <span style={pillStyle}>{data.split.length} authors</span>
        </div>
      </header>

      {/* 1) LoC growth */}
      <section style={sectionStyle}>
        <div style={sectionHeadStyle}>
          <span style={sectionTitleStyle}>LoC growth</span>
          <span style={sectionMetaStyle}>{minLoc} → {maxLoc}</span>
        </div>
        <svg
          width={w - bandPad * 2}
          height={lcH}
          viewBox={`0 0 ${w - bandPad * 2} ${lcH}`}
          style={{ display: "block", marginTop: 4 }}
        >
          <defs>
            <linearGradient id="fh-loc-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color.accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#fh-loc-area)" />
          <path
            d={linePath}
            fill="none"
            stroke={color.accent}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeDasharray={approxLen}
            style={{
              ["--fh-dash" as string]: `${approxLen}`,
              animation: `fh-line 900ms ${ENTRY_EASE} 120ms both`,
            } as CSSProperties}
          />
          {linePts.length > 0 && (
            <circle
              cx={linePts[linePts.length - 1]![0]}
              cy={linePts[linePts.length - 1]![1]}
              r={3.5}
              fill={color.accent}
              stroke="#fff"
              strokeWidth={1}
            />
          )}
        </svg>
      </section>

      {/* 2) Commit dots timeline */}
      <section style={sectionStyle}>
        <div style={sectionHeadStyle}>
          <span style={sectionTitleStyle}>commits · last {DAYS}d</span>
          <span style={sectionMetaStyle}>dot size ∝ lines changed</span>
        </div>
        <svg
          width={w - bandPad * 2}
          height={cbH}
          viewBox={`0 0 ${w - bandPad * 2} ${cbH}`}
          style={{ display: "block", marginTop: 4 }}
        >
          <line
            x1={0} x2={w - bandPad * 2}
            y1={cbH - 14} y2={cbH - 14}
            stroke={color.border}
            strokeWidth={1}
          />
          {[0, 90, 180, 270, 365].map(d => {
            const x = (w - bandPad * 2) * (1 - d / DAYS);
            return (
              <g key={d}>
                <line x1={x} x2={x} y1={cbH - 16} y2={cbH - 12} stroke={color.text3} strokeWidth={0.6} />
                <text
                  x={x} y={cbH - 2}
                  fontFamily={font.mono}
                  fontSize={9}
                  fill={color.text3}
                  textAnchor="middle"
                >
                  {d === 0 ? "now" : `${d}d`}
                </text>
              </g>
            );
          })}
          {data.commits.map((t, i) => {
            if (t < dotBandStart) return null;
            const cx = (w - bandPad * 2) * (1 - (now - t) / (DAYS * DAY_MS));
            const authorIdx = hashId(`${entity.id}::commit-author-${i}`) % data.split.length;
            const authorId = data.split[authorIdx]!.id;
            const hue = authorHue(authorId);
            const rng = seeded(`${entity.id}::commit-${i}`, "ch");
            const lines = Math.floor(rng() * 280 + 4);
            const r = Math.max(2, Math.min(9, 2 + Math.sqrt(lines) / 5));
            const cy = cbH - 20 - (hashId(`jitter-${i}`) % 22);
            return (
              <circle
                key={i}
                cx={cx} cy={cy} r={r}
                fill={hsl(hue, 60, 55, 0.72)}
                stroke={hsl(hue, 55, 40, 0.9)}
                strokeWidth={0.6}
                style={{
                  animation: `fh-dot 360ms ${ENTRY_EASE} ${140 + (i * 16) % 780}ms both`,
                  transformOrigin: `${cx}px ${cy}px`,
                }}
              >
                <title>{authorId} · {lines} lines changed</title>
              </circle>
            );
          })}
        </svg>
      </section>

      {/* 3) Blame rainbow */}
      <section style={sectionStyle}>
        <div style={sectionHeadStyle}>
          <span style={sectionTitleStyle}>blame rainbow</span>
          <span style={sectionMetaStyle}>{lineCount} lines · hue = primary author</span>
        </div>
        <div
          style={{
            display: "flex",
            height: rbH,
            marginTop: 4,
            borderRadius: radius.sm,
            overflow: "hidden",
            border: `1px solid ${color.border}`,
          }}
        >
          {rainbow.map((r, i) => (
            <div
              key={i}
              title={r.author}
              style={{
                flex: 1,
                background: hsl(r.hue, 60, 58),
                transformOrigin: "center bottom",
                animation: `fh-stripe 420ms ${ENTRY_EASE} ${180 + (i * 6) % 600}ms both`,
              }}
            />
          ))}
        </div>
        {/* Author legend */}
        <div style={legendStyle}>
          {data.split.slice(0, 8).map(s => (
            <span key={s.id} style={legendRowStyle}>
              <span style={{ ...legendDotStyle, background: hsl(authorHue(s.id), 60, 55) }} />
              <span style={legendAuthorStyle}>{s.id}</span>
              <span style={legendShareStyle}>{Math.round(s.share * 100)}%</span>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: color.bg0,
  color: color.text0,
  fontFamily: font.sans,
  animation: `fh-enter 520ms ${ENTRY_EASE} both`,
  overflow: "auto",
  padding: `${space[4]}px ${space[5]}px ${space[6]}px`,
  boxSizing: "border-box",
};

const emptyStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: color.text3,
  fontSize: font.size.md,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  marginBottom: space[4],
};

const titleStyle: CSSProperties = {
  fontSize: font.size.display,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
};

const fileNameStyle: CSSProperties = {
  color: color.text1,
  fontWeight: font.weight.medium,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  marginTop: 2,
};

const pillStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  padding: `2px ${space[2]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  color: color.text1,
};

const sectionStyle: CSSProperties = {
  marginBottom: space[4],
  padding: `${space[3]}px ${space[3]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const sectionHeadStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text1,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const sectionMetaStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

const legendStyle: CSSProperties = {
  display: "flex",
  gap: space[3],
  flexWrap: "wrap",
  marginTop: space[2],
};

const legendRowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontFamily: font.mono,
  fontSize: font.size.xxs,
};

const legendDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: radius.pill,
};

const legendAuthorStyle: CSSProperties = {
  color: color.text1,
};

const legendShareStyle: CSSProperties = {
  color: color.text3,
  fontVariantNumeric: "tabular-nums",
};

export const FileHistoryView = memo(FileHistoryViewImpl);
