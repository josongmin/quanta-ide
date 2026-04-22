// SemanticDiffView — symbol-level diff between two picked commits.
// --------------------------------------------------------------------
// Top: two commit pickers (before / after) with fabricated short-hash +
// relative date. Middle: bubble field — each bubble is a symbol whose
// colour/icon indicates its change kind (added/removed/renamed/moved).
// Bubbles stagger-spring in on commit change. Right: ranked file list
// showing how many symbol changes each file contains. Clicking a file
// filters the bubbles to only that file's changes.

import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import { hashId, seeded } from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

type ChangeKind = "added" | "removed" | "renamed" | "moved";

interface SymbolChange {
  id: string;
  fileId: string;
  fileName: string;
  name: string;
  kind: ChangeKind;
  x: number; // layout x (0..1)
  y: number; // layout y (0..1)
}

interface Commit {
  hash: string;
  msg: string;
  when: string; // relative, e.g. "2일 전"
  key: number;
}

const KIND_COLOR: Record<ChangeKind, string> = {
  added:   color.success,
  removed: color.danger,
  renamed: color.warn,
  moved:   color.accent,
};

const KIND_LABEL: Record<ChangeKind, string> = {
  added:   "추가",
  removed: "제거",
  renamed: "이름변경",
  moved:   "이동",
};

const KEYFRAMES = `
@keyframes sd-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes sd-bubble-in {
  0%   { opacity: 0; transform: translate(var(--x), var(--y)) scale(0.4); }
  100% { opacity: 1; transform: translate(var(--x), var(--y)) scale(1);   }
}
`;

const MSG_POOL = [
  "fix: handle null selection",
  "refactor: extract layer audit",
  "feat: add timelapse scrubber",
  "perf: memoize heavy computed",
  "fix(auth): ignore empty tokens",
  "refactor(store): reshape scene state",
  "feat: ownership mitosis cell",
  "chore: bump @quanta/canvas-engine",
];

function fakeCommit(seedKey: number, rootId: string | null): Commit {
  const seed = hashId(`${rootId ?? "root"}:commit:${seedKey}`);
  const hash = seed.toString(16).padStart(8, "0").slice(0, 7);
  const msg = MSG_POOL[seed % MSG_POOL.length]!;
  const days = (seed >>> 3) % 45;
  const when = days === 0 ? "방금 전" : `${days}일 전`;
  return { hash, msg, when, key: seedKey };
}

function buildChanges(tree: ViewContextValue["tree"], before: number, after: number): SymbolChange[] {
  if (!tree) return [];
  const files: Entity[] = [];
  for (const e of tree.byId.values()) if (e.kind === "building") files.push(e);
  files.sort((a, b) => a.id.localeCompare(b.id));
  const picked = files.slice(0, Math.min(40, files.length));

  const changes: SymbolChange[] = [];
  const rng = seeded(`${tree.rootId}:${before}:${after}`, "sd");
  for (const f of picked) {
    const nChanges = Math.floor(rng() * 4);
    for (let i = 0; i < nChanges; i++) {
      const r = rng();
      const kind: ChangeKind =
        r < 0.35 ? "added" : r < 0.60 ? "removed" : r < 0.82 ? "renamed" : "moved";
      const nameSeed = hashId(`${f.id}:${before}:${after}:${i}`);
      const name = ["handleClick", "parseInput", "toModel", "normalize", "render", "init", "dispatch", "reduce"][nameSeed % 8]!;
      const x = (hashId(`${f.id}:${i}:x`) % 1000) / 1000;
      const y = (hashId(`${f.id}:${i}:y`) % 1000) / 1000;
      changes.push({
        id: `${f.id}-${i}`,
        fileId: f.id,
        fileName: f.name,
        name,
        kind,
        x,
        y,
      });
    }
  }
  return changes;
}

function SemanticDiffViewImpl({ ctx }: Props): ReactElement {
  const [beforeKey, setBeforeKey] = useState(7);
  const [afterKey, setAfterKey] = useState(0);
  const [focusFile, setFocusFile] = useState<string | null>(null);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    s.dataset.semanticDiffKeyframes = "1";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const before = useMemo(() => fakeCommit(beforeKey, ctx.tree?.rootId ?? null), [beforeKey, ctx.tree?.rootId]);
  const after = useMemo(() => fakeCommit(afterKey, ctx.tree?.rootId ?? null), [afterKey, ctx.tree?.rootId]);
  const changes = useMemo(() => buildChanges(ctx.tree, beforeKey, afterKey), [ctx.tree, beforeKey, afterKey]);

  const perFile = useMemo(() => {
    const map = new Map<string, { fileId: string; name: string; counts: Record<ChangeKind, number>; total: number }>();
    for (const c of changes) {
      let agg = map.get(c.fileId);
      if (!agg) {
        agg = { fileId: c.fileId, name: c.fileName, counts: { added: 0, removed: 0, renamed: 0, moved: 0 }, total: 0 };
        map.set(c.fileId, agg);
      }
      agg.counts[c.kind]++;
      agg.total++;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [changes]);

  const perKind = useMemo(() => {
    const t: Record<ChangeKind, number> = { added: 0, removed: 0, renamed: 0, moved: 0 };
    for (const c of changes) t[c.kind]++;
    return t;
  }, [changes]);

  const visibleChanges = useMemo(
    () => focusFile ? changes.filter(c => c.fileId === focusFile) : changes,
    [changes, focusFile],
  );

  const onSwap = useCallback(() => {
    const b = beforeKey;
    setBeforeKey(afterKey);
    setAfterKey(b);
  }, [beforeKey, afterKey]);

  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>Semantic Diff</div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            심볼 레벨 변화 {changes.length}건 · {perFile.length} 파일
          </div>
        </div>
        <div style={commitRowStyle}>
          <CommitPicker label="BEFORE" commit={before} onPrev={() => setBeforeKey(k => k + 1)} onNext={() => setBeforeKey(k => Math.max(afterKey + 1, k - 1))} />
          <button type="button" onClick={onSwap} style={swapBtn} aria-label="교환">⇄</button>
          <CommitPicker label="AFTER" commit={after} onPrev={() => setAfterKey(k => Math.min(beforeKey - 1, k + 1))} onNext={() => setAfterKey(k => Math.max(0, k - 1))} />
        </div>
      </header>

      <div style={bodyStyle}>
        <section style={bubbleFieldStyle} aria-label="symbol bubbles">
          <Legend kindCounts={perKind} />
          <div style={fieldInnerStyle}>
            {visibleChanges.length === 0 ? (
              <div style={{ margin: "auto", color: color.text3, fontSize: font.size.sm }}>
                선택한 범위에 심볼 변화가 없습니다.
              </div>
            ) : (
              visibleChanges.map((c, i) => (
                <Bubble key={c.id} change={c} index={i} />
              ))
            )}
          </div>
        </section>

        <aside style={sidebarStyle}>
          <div style={sidebarHeadStyle}>파일별 변화</div>
          <div style={{ flex: 1, overflow: "auto" }}>
            {perFile.length === 0 ? (
              <div style={{ padding: space[4], color: color.text3, fontSize: font.size.sm }}>변화 없음</div>
            ) : (
              perFile.map(row => (
                <button
                  key={row.fileId}
                  type="button"
                  onClick={() => {
                    setFocusFile(cur => cur === row.fileId ? null : row.fileId);
                    ctx.dispatch.selectEntity(row.fileId);
                  }}
                  style={{
                    ...fileRowStyle,
                    ...(focusFile === row.fileId ? fileRowActiveStyle : {}),
                  }}
                >
                  <span style={{ fontSize: font.size.sm, color: color.text0, fontWeight: font.weight.medium, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
                  <span style={fileRowCountsStyle}>
                    {row.counts.added > 0   && <span style={{ color: KIND_COLOR.added }}>+{row.counts.added}</span>}
                    {row.counts.removed > 0 && <span style={{ color: KIND_COLOR.removed }}>−{row.counts.removed}</span>}
                    {row.counts.renamed > 0 && <span style={{ color: KIND_COLOR.renamed }}>~{row.counts.renamed}</span>}
                    {row.counts.moved > 0   && <span style={{ color: KIND_COLOR.moved }}>→{row.counts.moved}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function CommitPicker({ label, commit, onPrev, onNext }: { label: string; commit: Commit; onPrev: () => void; onNext: () => void }) {
  return (
    <div style={commitBoxStyle}>
      <span style={{ fontSize: font.size.xxs, letterSpacing: font.letter.ultra, color: color.text2 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
        <button type="button" onClick={onPrev} style={navBtn} aria-label="이전 커밋">‹</button>
        <div style={{ minWidth: 220 }}>
          <div style={{ fontFamily: font.mono, fontSize: font.size.xs, color: color.text0 }}>{commit.hash}</div>
          <div style={{ fontSize: font.size.xxs, color: color.text2, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {commit.msg} · {commit.when}
          </div>
        </div>
        <button type="button" onClick={onNext} style={navBtn} aria-label="다음 커밋">›</button>
      </div>
    </div>
  );
}

function Legend({ kindCounts }: { kindCounts: Record<ChangeKind, number> }) {
  const entries = (Object.entries(kindCounts) as Array<[ChangeKind, number]>).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;
  return (
    <div style={legendStyle}>
      {entries.map(([k, v]) => (
        <span key={k} style={legendChip}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: KIND_COLOR[k], display: "inline-block" }} />
          {KIND_LABEL[k]} <span style={{ fontVariantNumeric: "tabular-nums", color: color.text0, fontWeight: font.weight.semibold }}>{v}</span>
        </span>
      ))}
    </div>
  );
}

function Bubble({ change, index }: { change: SymbolChange; index: number }) {
  const tint = KIND_COLOR[change.kind];
  return (
    <div
      style={{
        position: "absolute",
        left: `${change.x * 100}%`,
        top: `${change.y * 100}%`,
        transform: `translate(-50%, -50%)`,
        padding: `${space[1]}px ${space[2]}px`,
        background: `${tint}15`,
        border: `1px solid ${tint}`,
        borderRadius: radius.pill,
        display: "inline-flex",
        alignItems: "center",
        gap: space[1],
        fontFamily: font.mono,
        fontSize: font.size.xxs,
        color: color.text0,
        whiteSpace: "nowrap",
        boxShadow: shadow.xs,
        opacity: 0,
        animation: `sd-enter 420ms cubic-bezier(0.22, 1, 0.28, 1) both`,
        animationDelay: `${Math.min(index, 80) * 14}ms`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: tint }} />
      {change.name}
      <span style={{ color: color.text3, fontSize: 9 }}>· {change.fileName}</span>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: space[4],
  animation: "sd-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: space[4],
  flexWrap: "wrap",
};

const commitRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: space[2],
};

const commitBoxStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[1],
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const navBtn: CSSProperties = {
  width: 24,
  height: 24,
  border: `1px solid ${color.border}`,
  background: color.bg0,
  color: color.text1,
  borderRadius: radius.sm,
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
};

const swapBtn: CSSProperties = {
  width: 32,
  border: `1px solid ${color.border}`,
  background: color.bg0,
  color: color.text1,
  borderRadius: radius.sm,
  cursor: "pointer",
  fontSize: 14,
  padding: 0,
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "1fr 320px",
  gap: space[4],
};

const bubbleFieldStyle: CSSProperties = {
  position: "relative",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const fieldInnerStyle: CSSProperties = {
  position: "relative",
  flex: 1,
  minHeight: 0,
};

const legendStyle: CSSProperties = {
  display: "flex",
  gap: space[3],
  padding: `${space[3]}px ${space[4]}px`,
  borderBottom: `1px solid ${color.border}`,
  fontSize: font.size.xs,
  color: color.text2,
  flexWrap: "wrap",
};

const legendChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[1],
};

const sidebarStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  overflow: "hidden",
  minHeight: 0,
};

const sidebarHeadStyle: CSSProperties = {
  padding: `${space[3]}px ${space[4]}px`,
  fontSize: font.size.xs,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  color: color.text2,
  borderBottom: `1px solid ${color.border}`,
  fontWeight: font.weight.semibold,
};

const fileRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "center",
  width: "100%",
  padding: `${space[2]}px ${space[4]}px`,
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${color.border}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  gap: space[2],
  transition: `background ${transition.base}`,
};

const fileRowActiveStyle: CSSProperties = {
  background: color.accentSofter,
};

const fileRowCountsStyle: CSSProperties = {
  display: "inline-flex",
  gap: space[2],
  fontFamily: font.mono,
  fontSize: font.size.xs,
  fontVariantNumeric: "tabular-nums",
};

export const SemanticDiffView = memo(SemanticDiffViewImpl);
