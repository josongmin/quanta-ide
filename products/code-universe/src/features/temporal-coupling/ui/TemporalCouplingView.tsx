// TemporalCouplingView — co-change rendered as a music staff.
// --------------------------------------------------------------------
// Top axis = time (old → new). Each horizontal line = a file (at its
// vertical "pitch"). A commit that touches multiple files draws a
// vertical "chord" — notes at each touched file, joined by a thin
// stem. Chords with many notes read as dense vertical beams; files
// that often appear together form visible recurring patterns.
// Hover a chord → highlights its files in the left legend.

import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import { commitHistory } from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

interface Chord {
  t: number;         // commit timestamp (ms)
  x: number;         // layout x (px)
  noteIdx: number[]; // file indices in this chord
}

interface FileRow {
  entity: Entity;
  y: number; // layout y
  total: number;
}

const STAFF_LINES = 5; // decorative 5-line staff rendered behind the notes
const KEYFRAMES = `
@keyframes tcv-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes tcv-note-in { 0% { opacity: 0; transform: scale(0.3); } 100% { opacity: 1; transform: scale(1); } }
`;

const WINDOW_DAYS = 180;

function buildScore(ctx: ViewContextValue) {
  if (!ctx.tree) return { files: [] as FileRow[], chords: [] as Chord[], tMin: 0, tMax: 0 };
  const entities: Entity[] = [];
  for (const e of ctx.tree.byId.values()) if (e.kind === "building") entities.push(e);
  // Top-N by total recent commits so the staff stays readable.
  const ranked = entities
    .map(e => ({ e, count: commitHistory(e, WINDOW_DAYS).length }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);
  if (ranked.length === 0) return { files: [], chords: [], tMin: 0, tMax: 0 };

  const files: FileRow[] = ranked.map((r, i) => ({
    entity: r.e,
    y: i,
    total: r.count,
  }));

  // Union all commit timestamps → bucket by day → any file whose commits
  // fall in the same bucket forms a chord.
  const idxOf = new Map<string, number>();
  files.forEach((f, i) => idxOf.set(f.entity.id, i));

  const now = Date.now();
  const windowStart = now - WINDOW_DAYS * 86400_000;
  const bucketMs = 86400_000; // 1 day
  const byBucket = new Map<number, Set<number>>();
  let tMin = Infinity, tMax = -Infinity;
  for (const f of files) {
    const hist = commitHistory(f.entity, WINDOW_DAYS);
    for (const t of hist) {
      if (t < windowStart) continue;
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
      const bucket = Math.floor(t / bucketMs);
      let set = byBucket.get(bucket);
      if (!set) { set = new Set(); byBucket.set(bucket, set); }
      set.add(f.y);
    }
  }
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax)) {
    return { files, chords: [], tMin: 0, tMax: 0 };
  }
  // pad a little so extreme edges don't clip
  const pad = (tMax - tMin) * 0.04 + 86400_000;
  tMin -= pad;
  tMax += pad;

  const chords: Chord[] = [];
  for (const [bucket, idxs] of byBucket) {
    if (idxs.size < 1) continue;
    const t = bucket * bucketMs + bucketMs / 2;
    chords.push({
      t,
      x: 0, // laid out later after we know width
      noteIdx: [...idxs].sort((a, b) => a - b),
    });
  }
  chords.sort((a, b) => a.t - b.t);

  return { files, chords, tMin, tMax };
}

function TemporalCouplingViewImpl({ ctx }: Props): ReactElement {
  const { files, chords, tMin, tMax } = useMemo(() => buildScore(ctx), [ctx]);
  const [hoverChord, setHoverChord] = useState<number | null>(null);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    s.dataset.temporalCouplingKeyframes = "1";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const handleChordHover = useCallback((i: number | null) => {
    setHoverChord(i);
  }, []);

  if (files.length === 0) {
    return <div style={emptyStyle}><div style={{ color: color.text2, fontSize: font.size.md }}>커밋 기록이 없어 악보를 그릴 수 없습니다.</div></div>;
  }

  // Layout constants.
  const STAFF_W = 1400;
  const STAFF_H = Math.max(360, files.length * 26 + 80);
  const LEFT_GUTTER = 220;
  const TOP_PAD = 40;
  const BOTTOM_PAD = 30;
  const noteArea = STAFF_W - LEFT_GUTTER - 40;
  const rowStep = (STAFF_H - TOP_PAD - BOTTOM_PAD) / Math.max(1, files.length - 1);
  const tSpan = Math.max(1, tMax - tMin);

  const positionX = (t: number) => LEFT_GUTTER + ((t - tMin) / tSpan) * noteArea;

  const chordsLaidOut = useMemo(
    () => chords.map(c => ({ ...c, x: positionX(c.t) })),
    [chords, tMin, tMax, noteArea],
  );

  const highlightedFiles = hoverChord !== null
    ? new Set(chordsLaidOut[hoverChord]?.noteIdx ?? [])
    : new Set<number>();

  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>Temporal Coupling</div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            {files.length}개 파일 · {chords.length}개 chord · 같이 연주되는 파일이 같은 세로줄에 정렬
          </div>
        </div>
        <Legend chordCount={chords.length} polyCount={chords.filter(c => c.noteIdx.length >= 3).length} />
      </header>

      <div style={scrollWrap}>
        <svg width={STAFF_W} height={STAFF_H} style={{ display: "block" }}>
          {/* Staff lines — 5 decorative horizontal groups (musical nod) */}
          {Array.from({ length: STAFF_LINES }, (_, i) => {
            const groupY = TOP_PAD + (rowStep * (files.length - 1)) * (i / (STAFF_LINES - 1));
            return (
              <line key={`staff-${i}`}
                x1={LEFT_GUTTER} y1={groupY}
                x2={STAFF_W - 20} y2={groupY}
                stroke={color.border} strokeWidth={0.6} strokeDasharray="2 6"
              />
            );
          })}

          {/* File rows */}
          {files.map((f, i) => {
            const y = TOP_PAD + rowStep * i;
            const hot = highlightedFiles.has(i);
            return (
              <g key={f.entity.id}>
                {/* Track hairline */}
                <line x1={LEFT_GUTTER} y1={y} x2={STAFF_W - 20} y2={y}
                  stroke={hot ? color.accent : color.bg3}
                  strokeWidth={hot ? 1.0 : 0.6}
                  strokeOpacity={hot ? 0.75 : 0.9}
                />
                {/* Left label */}
                <text x={LEFT_GUTTER - 12} y={y + 3}
                  fontFamily={font.mono} fontSize={10.5}
                  fill={hot ? color.accent : color.text1}
                  textAnchor="end"
                  style={{ transition: `fill ${transition.base}` }}
                >
                  {f.entity.name.length > 24 ? f.entity.name.slice(0, 22) + "…" : f.entity.name}
                </text>
                {/* Commit count pill */}
                <text x={LEFT_GUTTER - 12} y={y + 15}
                  fontFamily={font.mono} fontSize={9}
                  fill={color.text3}
                  textAnchor="end"
                >
                  {f.total}
                </text>
              </g>
            );
          })}

          {/* Chords */}
          {chordsLaidOut.map((chord, ci) => {
            const notes = chord.noteIdx;
            const yTop = TOP_PAD + rowStep * notes[0]!;
            const yBot = TOP_PAD + rowStep * notes[notes.length - 1]!;
            const isPoly = notes.length >= 3;
            const isHover = ci === hoverChord;
            const tint = isPoly ? color.accent : color.text2;
            return (
              <g
                key={ci}
                onMouseEnter={() => handleChordHover(ci)}
                onMouseLeave={() => handleChordHover(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Invisible hit area */}
                <rect x={chord.x - 8} y={yTop - 10} width={16} height={yBot - yTop + 20} fill="transparent" />
                {/* Stem */}
                {notes.length > 1 && (
                  <line
                    x1={chord.x} y1={yTop}
                    x2={chord.x} y2={yBot}
                    stroke={tint}
                    strokeWidth={isHover ? 1.6 : 1.0}
                    strokeOpacity={isHover ? 0.85 : 0.45}
                    style={{ transition: `stroke-width ${transition.base}, stroke-opacity ${transition.base}` }}
                  />
                )}
                {/* Notes */}
                {notes.map((idx, ni) => {
                  const y = TOP_PAD + rowStep * idx;
                  const r = isPoly ? 3.2 : 2.4;
                  return (
                    <circle
                      key={ni}
                      cx={chord.x} cy={y} r={r}
                      fill={tint}
                      fillOpacity={isHover ? 0.95 : (isPoly ? 0.8 : 0.6)}
                      stroke="white"
                      strokeWidth={0.8}
                      style={{
                        transformOrigin: `${chord.x}px ${y}px`,
                        transition: `r ${transition.base}, fill-opacity ${transition.base}`,
                        animation: `tcv-note-in 360ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                        animationDelay: `${Math.min(ci, 80) * 8 + ni * 14}ms`,
                      }}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Time axis */}
          <g>
            <line x1={LEFT_GUTTER} y1={STAFF_H - BOTTOM_PAD + 10} x2={STAFF_W - 20} y2={STAFF_H - BOTTOM_PAD + 10}
              stroke={color.border} strokeWidth={0.8} />
            <text x={LEFT_GUTTER} y={STAFF_H - BOTTOM_PAD + 24}
              fontFamily={font.sans} fontSize={10} fill={color.text2}>
              {new Date(tMin).toLocaleDateString()}
            </text>
            <text x={STAFF_W - 20} y={STAFF_H - BOTTOM_PAD + 24}
              fontFamily={font.sans} fontSize={10} fill={color.text2}
              textAnchor="end">
              {new Date(tMax).toLocaleDateString()}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}

function Legend({ chordCount, polyCount }: { chordCount: number; polyCount: number }) {
  return (
    <div style={{ display: "flex", gap: space[4], fontSize: font.size.xs, color: color.text2 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: space[1] }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color.text2 }} />
        단음 <span style={{ color: color.text0, fontWeight: font.weight.semibold, fontVariantNumeric: "tabular-nums" }}>{chordCount - polyCount}</span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: space[1] }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color.accent }} />
        화음 (≥3 동시) <span style={{ color: color.text0, fontWeight: font.weight.semibold, fontVariantNumeric: "tabular-nums" }}>{polyCount}</span>
      </span>
    </div>
  );
}

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  animation: "tcv-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  marginBottom: space[4],
  flexWrap: "wrap",
  gap: space[3],
};

const scrollWrap: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  padding: space[4],
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const TemporalCouplingView = memo(TemporalCouplingViewImpl);
