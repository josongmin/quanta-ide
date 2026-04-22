// WhereToView — "where should this go?" folder heat-map search.
// --------------------------------------------------------------------
// Layout:
//   • Left 38%: query input + top-3 ranked folder matches with "why"
//     (top keyword hits). Sleek 1px input with accent focus ring.
//   • Right 62%: folder tree drawn as a radial cell grid. Each non-leaf
//     entity renders a rounded cell whose fill intensity = match score.
//     Hot folders glow soft amber; cold stay neutral gray. Hover surfaces
//     the path + score breakdown.
//
// Scoring (per non-leaf folder):
//   • naive  = # query tokens found in descendant file names (CI)
//   • semantic = seeded(folder.id, query)()  — fake embedding sim
//   • combined = 0.7 * naive_norm + 0.3 * semantic, clipped to [0..1]
//
// Input is debounced 150ms. Min query length = 3 chars before scoring.
// Entrance: single fade+scale on root; per-cell stagger 14ms.

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import type { Entity } from "@quanta/canvas-engine";
import type { EntityTree } from "../../../entities/entity";
import {
  color as tokenColor,
  font,
  radius,
  shadow,
  space,
  transition,
} from "../../../shared/ui/tokens";
import { seeded } from "../../../shared/analytics/synth-metrics";

// ── Props ─────────────────────────────────────────────────────────────

export interface WhereToViewProps {
  tree: EntityTree;
  selectedId: string | null;
  onFocusEntity?: (id: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────

const MIN_QUERY_LEN = 3;
const DEBOUNCE_MS = 150;
const ENTRY_MS = 520;
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const STAGGER_MS = 14;
// Amber accent for top-ranked folder — sourced from the token set so the
// hue stays in lock-step with refactor/warn surfaces elsewhere.
const AMBER = tokenColor.warn;

// ── Keyframes (one-shot injection) ───────────────────────────────────

const STYLE_ID = "where-to-view-styles";
function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes wtv-enter {
      from { opacity: 0; transform: scale(0.985); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes wtv-cell-in {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes wtv-rank-in {
      from { opacity: 0; transform: translateX(-4px); }
      to   { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
}

// ── Scoring ───────────────────────────────────────────────────────────

interface FolderScore {
  entity: Entity;
  naive: number;
  semantic: number;
  combined: number;
  hitTokens: string[];
  descendantFiles: number;
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[\s,._/\-]+/)
    .map(t => t.trim())
    .filter(t => t.length > 1);
}

/** Walk descendants, collecting all `building` (file) names. */
function descendantFileNames(tree: EntityTree, rootId: string): string[] {
  const out: string[] = [];
  const stack: string[] = [rootId];
  const limit = 2000; // defensive cap
  let seen = 0;
  while (stack.length > 0 && seen < limit) {
    const id = stack.pop();
    if (!id) break;
    const e = tree.byId.get(id);
    if (!e) continue;
    seen++;
    if (e.kind === "building") out.push(e.name.toLowerCase());
    for (const c of e.childIds) stack.push(c);
  }
  return out;
}

/** Score every non-leaf entity against a query (tokens already extracted). */
function scoreFolders(tree: EntityTree, tokens: string[], rawQuery: string): FolderScore[] {
  if (tokens.length === 0) return [];
  const entries: FolderScore[] = [];

  // Folders = non-file non-leaf kinds.
  const NON_LEAF = new Set(["universe", "galaxy", "street"]);

  // Compute max raw naive across candidates for normalization.
  let maxNaive = 0;

  const interim: Array<{
    entity: Entity;
    naive: number;
    hitSet: Map<string, number>;
    descFiles: number;
  }> = [];

  for (const e of tree.byId.values()) {
    if (!NON_LEAF.has(e.kind)) continue;
    const names = descendantFileNames(tree, e.id);
    if (names.length === 0) continue;

    const hitSet = new Map<string, number>();
    let naive = 0;
    for (const t of tokens) {
      let n = 0;
      for (const name of names) if (name.includes(t)) n++;
      if (n > 0) {
        hitSet.set(t, n);
        naive += n;
      }
    }
    if (naive > maxNaive) maxNaive = naive;
    interim.push({ entity: e, naive, hitSet, descFiles: names.length });
  }

  for (const row of interim) {
    // Normalize naive by folder size (so small folders aren't punished
    // for being small, but also don't get free lunch from `file` only
    // matching once). We blend raw count with density.
    const density = row.naive / Math.max(1, row.descFiles);
    const byVolume = row.naive / Math.max(1, maxNaive);
    const naiveNorm = Math.min(1, byVolume * 0.6 + density * 1.4);

    // Semantic — seeded per (folder, query) so it's stable while typing.
    // Bias toward lower values so it mostly just reorders ties.
    const semRaw = seeded(row.entity.id, `wt::${rawQuery}`)();
    const semantic = Math.pow(semRaw, 1.6);

    // Only award semantic when there's at least SOME naive signal OR
    // the folder's own name matches a token — otherwise the heat map
    // would glow randomly.
    const nameMatch = tokens.some(t => row.entity.name.toLowerCase().includes(t));
    const semanticGated = (row.naive > 0 || nameMatch) ? semantic : semantic * 0.25;

    const combined = Math.min(1, 0.7 * naiveNorm + 0.3 * semanticGated);

    const hitTokens = [...row.hitSet.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);

    entries.push({
      entity: row.entity,
      naive: naiveNorm,
      semantic: semanticGated,
      combined,
      hitTokens,
      descendantFiles: row.descFiles,
    });
  }

  entries.sort((a, b) => b.combined - a.combined);
  return entries;
}

// ── Heat cell ─────────────────────────────────────────────────────────

/** Parse a "#rrggbb" token string into an {r,g,b} triple. */
function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const HEAT_COLD = parseHex(tokenColor.bg3);
const HEAT_HOT = parseHex(tokenColor.warn);

/** Interpolate from neutral bg3 → soft amber by heat 0..1. Endpoints
 *  live in the shared token set so the palette tracks any retune. */
function heatColor(heat: number): string {
  const t = Math.max(0, Math.min(1, heat));
  const r = Math.round(HEAT_COLD.r + (HEAT_HOT.r - HEAT_COLD.r) * t);
  const g = Math.round(HEAT_COLD.g + (HEAT_HOT.g - HEAT_COLD.g) * t);
  const b = Math.round(HEAT_COLD.b + (HEAT_HOT.b - HEAT_COLD.b) * t);
  return `rgb(${r},${g},${b})`;
}

function heatTextColor(heat: number): string {
  return heat > 0.55 ? "#ffffff" : tokenColor.text0;
}

// ── Main ──────────────────────────────────────────────────────────────

function WhereToViewImpl({ tree, selectedId, onFocusEntity }: WhereToViewProps) {
  injectStyles();

  const [rawInput, setRawInput] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  // Debounce the raw input into `query`.
  useEffect(() => {
    const h = setTimeout(() => setQuery(rawInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [rawInput]);

  const tokens = useMemo(
    () => (query.length >= MIN_QUERY_LEN ? tokenize(query) : []),
    [query],
  );

  const scores = useMemo(
    () => scoreFolders(tree, tokens, query),
    [tree, tokens, query],
  );

  const scoresById = useMemo(() => {
    const m = new Map<string, FolderScore>();
    for (const s of scores) m.set(s.entity.id, s);
    return m;
  }, [scores]);

  const top3 = scores.slice(0, 3);
  const hasQuery = tokens.length > 0;

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRawInput(e.target.value);
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      onFocusEntity?.(id);
    },
    [onFocusEntity],
  );

  // All non-leaf entities, stable layout order (by path).
  const folders = useMemo(() => {
    const NON_LEAF = new Set(["universe", "galaxy", "street"]);
    const out: Entity[] = [];
    for (const e of tree.byId.values()) {
      if (!NON_LEAF.has(e.kind)) continue;
      out.push(e);
    }
    out.sort((a, b) => a.path.localeCompare(b.path));
    return out;
  }, [tree]);

  // ── Styles ──────────────────────────────────────────────────────────

  const rootStyle: CSSProperties = {
    display: "flex",
    width: "100%",
    height: "100%",
    background: tokenColor.bg0,
    fontFamily: font.sans,
    color: tokenColor.text0,
    animation: `wtv-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    overflow: "hidden",
  };

  const leftStyle: CSSProperties = {
    width: "38%",
    minWidth: 320,
    display: "flex",
    flexDirection: "column",
    padding: `${space[5]}px ${space[5]}px ${space[4]}px`,
    gap: space[4],
    borderRight: `1px solid ${tokenColor.border}`,
    overflow: "hidden",
  };

  const rightStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    padding: `${space[5]}px ${space[5]}px ${space[4]}px`,
    overflow: "hidden",
  };

  const titleStyle: CSSProperties = {
    fontSize: font.size.display,
    fontWeight: font.weight.bold,
    color: tokenColor.text0,
    lineHeight: 1.15,
    letterSpacing: font.letter.tight as number,
  };

  const subtitleStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
    marginTop: 2,
  };

  const inputWrapStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    background: tokenColor.bg0,
    border: `1px solid ${focused ? "transparent" : tokenColor.border}`,
    borderRadius: 6,
    boxShadow: focused
      ? `0 0 0 3px ${tokenColor.accentBorder}, 0 0 0 1px ${tokenColor.accent}`
      : "none",
    transition: `box-shadow ${transition.base}, border-color ${transition.base}`,
  };

  const inputGlyphStyle: CSSProperties = {
    color: tokenColor.text3,
    paddingLeft: 12,
    fontSize: font.size.md,
    lineHeight: 1,
    flexShrink: 0,
  };

  const inputStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    height: 36,
    padding: "0 12px",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: font.size.md,
    fontFamily: font.sans,
    color: tokenColor.text0,
  };

  const inputHintStyle: CSSProperties = {
    fontSize: font.size.xxs,
    color: tokenColor.text3,
    marginTop: 4,
    fontFamily: font.sans,
  };

  // Right-pane layout geometry for heat cells.
  const cellMin = 92;
  const cellH = 52;

  return (
    <div style={rootStyle} role="region" aria-label="Where-to folder search">
      {/* ── LEFT: input + ranked results ───────────────────────────── */}
      <div style={leftStyle}>
        <div>
          <div style={titleStyle}>Where?</div>
          <div style={subtitleStyle}>여기 추가하면 어디?</div>
        </div>

        <div>
          <div
            style={inputWrapStyle}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          >
            <span style={inputGlyphStyle} aria-hidden="true">?</span>
            <input
              type="text"
              value={rawInput}
              onChange={handleInput}
              placeholder="기능 설명 입력: 예) auth rate-limit 관련 코드"
              aria-label="기능 설명"
              style={inputStyle}
              autoFocus
              spellCheck={false}
            />
          </div>
          <div style={inputHintStyle}>
            최소 {MIN_QUERY_LEN}글자. 쉼표·공백으로 여러 키워드.
          </div>
        </div>

        {/* Ranked list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: space[1],
            overflow: "auto",
            minHeight: 0,
          }}
        >
          <div
            style={{
              fontSize: font.size.xxs,
              color: tokenColor.text3,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: font.weight.semibold,
              marginBottom: space[1],
            }}
          >
            Top matches
          </div>
          {!hasQuery && (
            <div
              style={{
                fontSize: font.size.xs,
                color: tokenColor.text2,
                padding: `${space[3]}px ${space[2]}px`,
                background: tokenColor.bg2,
                borderRadius: radius.md,
                border: `1px solid ${tokenColor.border}`,
                lineHeight: 1.5,
              }}
            >
              쿼리를 입력하면 유사도 기반으로 폴더를 랭킹합니다.
            </div>
          )}
          {hasQuery && top3.length === 0 && (
            <div
              style={{
                fontSize: font.size.xs,
                color: tokenColor.text2,
                padding: `${space[3]}px ${space[2]}px`,
                background: tokenColor.bg2,
                borderRadius: radius.md,
                border: `1px solid ${tokenColor.border}`,
              }}
            >
              일치하는 폴더가 없습니다.
            </div>
          )}
          {hasQuery &&
            top3.map((s, idx) => (
              <RankRow
                key={s.entity.id}
                score={s}
                rank={idx + 1}
                isSelected={selectedId === s.entity.id}
                onSelect={() => handleSelect(s.entity.id)}
              />
            ))}
        </div>
      </div>

      {/* ── RIGHT: folder heat map ─────────────────────────────────── */}
      <div style={rightStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: space[3],
          }}
        >
          <div>
            <div
              style={{
                fontSize: font.size.sm,
                fontWeight: font.weight.semibold,
                color: tokenColor.text0,
              }}
            >
              Folder heat map
            </div>
            <div style={{ fontSize: font.size.xxs, color: tokenColor.text2, marginTop: 2 }}>
              키워드 × 임베딩 (AST 요약 벡터)
            </div>
          </div>
          <HeatLegend />
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            border: `1px solid ${tokenColor.border}`,
            borderRadius: radius.md,
            padding: space[3],
            background: tokenColor.bg1,
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${cellMin}px, 1fr))`,
            gap: space[2],
            alignContent: "start",
          }}
        >
          {folders.map((f, i) => {
            const s = scoresById.get(f.id);
            const heat = hasQuery ? (s?.combined ?? 0) : 0;
            const isHovered = hoveredId === f.id;
            const isSelected = selectedId === f.id;
            const isTop = hasQuery && top3.some(t => t.entity.id === f.id);

            const bg = hasQuery ? heatColor(heat) : tokenColor.bg2;
            const fg = hasQuery ? heatTextColor(heat) : tokenColor.text1;
            const pct = Math.round(heat * 100);

            const cellStyle: CSSProperties = {
              height: cellH,
              borderRadius: radius.sm,
              border: `1px solid ${
                isSelected
                  ? tokenColor.accent
                  : isHovered
                  ? tokenColor.borderStrong
                  : tokenColor.border
              }`,
              background: bg,
              color: fg,
              padding: `${space[1]}px ${space[2]}px`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              cursor: "pointer",
              transition: `transform ${transition.base}, background-color ${transition.base}, border-color ${transition.base}`,
              transform: isHovered ? "translateY(-1px)" : "translateY(0)",
              boxShadow: isHovered ? shadow.sm : "none",
              animation: `wtv-cell-in 320ms ${ENTRY_EASE} both`,
              animationDelay: `${Math.min(i * STAGGER_MS, 560)}ms`,
              position: "relative",
              overflow: "hidden",
            };

            return (
              <button
                key={f.id}
                type="button"
                style={cellStyle}
                onMouseEnter={() => setHoveredId(f.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleSelect(f.id)}
                title={f.path}
                aria-label={`${f.name} — heat ${pct}%`}
              >
                <div
                  style={{
                    fontSize: font.size.xs,
                    fontWeight: font.weight.semibold,
                    fontFamily: font.mono,
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {f.name || "/"}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 4,
                    fontSize: font.size.xxs,
                    opacity: 0.82,
                  }}
                >
                  <span style={{ fontFamily: font.sans }}>
                    {hasQuery ? `${pct}%` : `${f.childIds.length}`}
                  </span>
                  {isTop && (
                    <span
                      style={{
                        fontFamily: font.sans,
                        fontWeight: font.weight.bold,
                        letterSpacing: "0.06em",
                        fontSize: 9,
                        padding: "1px 5px",
                        borderRadius: radius.pill,
                        background: "rgba(255,255,255,0.32)",
                        color: "#ffffff",
                      }}
                    >
                      TOP{top3.findIndex(t => t.entity.id === f.id) + 1}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Ranked row ────────────────────────────────────────────────────────

interface RankRowProps {
  score: FolderScore;
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
}

function RankRow({ score, rank, isSelected, onSelect }: RankRowProps) {
  const [hovered, setHovered] = useState(false);
  const pct = Math.round(score.combined * 100);

  const rowStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: `${space[2]}px ${space[2]}px`,
    borderRadius: radius.md,
    border: `1px solid ${
      isSelected ? tokenColor.accentBorder : "transparent"
    }`,
    background: isSelected
      ? tokenColor.accentSoft
      : hovered
      ? tokenColor.hover
      : tokenColor.bg2,
    cursor: "pointer",
    transition: `background-color ${transition.base}, border-color ${transition.base}`,
    textAlign: "left",
    animation: `wtv-rank-in 360ms ${ENTRY_EASE} both`,
    animationDelay: `${rank * 40}ms`,
  };

  const headStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[2],
  };

  const rankBadgeStyle: CSSProperties = {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    background: rank === 1 ? AMBER : tokenColor.bg3,
    color: rank === 1 ? "#ffffff" : tokenColor.text1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: font.size.xxs,
    fontWeight: font.weight.bold,
    fontFamily: font.sans,
    flexShrink: 0,
  };

  const nameStyle: CSSProperties = {
    fontFamily: font.mono,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: tokenColor.text0,
    flex: 1,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const pctStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: rank === 1 ? AMBER : tokenColor.text1,
    fontWeight: font.weight.bold,
    fontFamily: font.sans,
    flexShrink: 0,
  };

  const pathStyle: CSSProperties = {
    fontFamily: font.mono,
    fontSize: font.size.xxs,
    color: tokenColor.text3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    paddingLeft: 26,
  };

  const whyStyle: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    paddingLeft: 26,
    marginTop: 2,
  };

  const chipStyle: CSSProperties = {
    fontSize: font.size.xxs,
    fontFamily: font.mono,
    color: tokenColor.text1,
    background: tokenColor.bg1,
    border: `1px solid ${tokenColor.border}`,
    borderRadius: radius.pill,
    padding: "1px 6px",
    lineHeight: 1.4,
  };

  return (
    <button
      type="button"
      style={rowStyle}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`rank ${rank}: ${score.entity.name} ${pct}%`}
    >
      <div style={headStyle}>
        <span style={rankBadgeStyle}>{rank}</span>
        <span style={nameStyle} title={score.entity.name}>
          {score.entity.name || "/"}
        </span>
        <span style={pctStyle}>{pct}%</span>
      </div>
      <div style={pathStyle} title={score.entity.path}>
        {score.entity.path}
      </div>
      {score.hitTokens.length > 0 && (
        <div style={whyStyle} aria-label="matching keywords">
          {score.hitTokens.slice(0, 5).map(t => (
            <span key={t} style={chipStyle}>
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ── Legend ────────────────────────────────────────────────────────────

function HeatLegend() {
  const legendStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[2],
    fontSize: font.size.xxs,
    color: tokenColor.text2,
    fontFamily: font.sans,
  };
  const swatchStyle: CSSProperties = {
    display: "inline-flex",
    width: 72,
    height: 6,
    borderRadius: 3,
    background: `linear-gradient(90deg, ${heatColor(0)} 0%, ${heatColor(0.5)} 50%, ${heatColor(1)} 100%)`,
    border: `1px solid ${tokenColor.border}`,
  };
  return (
    <div style={legendStyle}>
      <span>cold</span>
      <span style={swatchStyle} aria-hidden="true" />
      <span>hot</span>
    </div>
  );
}

export const WhereToView = memo(WhereToViewImpl);
