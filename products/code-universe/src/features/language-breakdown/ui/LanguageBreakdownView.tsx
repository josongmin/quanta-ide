// LanguageBreakdownView — GitHub-style language distribution bar + legend.
// --------------------------------------------------------------------
// References:
//   - GitHub repository language bar (single-row horizontal stacked bar
//     with hue-per-language, legend % beneath).
//   - GitHub Linguist — language detection library that powers the bar
//     (here we stand in with file-extension heuristics on LoC).
// Applied here: glanceable polyglot composition for the whole repo plus
// a "Top language files" ranked list on the right so onboarding engineers
// can jump straight into the largest file of whichever language they own.

import { memo, useMemo, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  LANGUAGE_COLOR,
  languageBreakdown,
  type LanguageKey,
  type LanguageStat,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";

const KEYFRAMES = `
@keyframes lb-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes lb-row   { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes lb-bar   { 0% { opacity: 0; transform: scaleX(0.6); } 100% { opacity: 1; transform: scaleX(1); } }
`;

const LANGUAGE_OF_EXT: Record<string, LanguageKey> = {
  ts: "typescript", tsx: "typescript", d: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  py: "python", pyi: "python",
  rs: "rust",
  go: "go",
  java: "java", kt: "java", scala: "java",
  css: "css", scss: "css", less: "css",
  html: "html", htm: "html",
  json: "json", yaml: "json", yml: "json", toml: "json",
  md: "markdown", mdx: "markdown",
};

const LANGUAGE_LABEL: Record<LanguageKey, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python:     "Python",
  rust:       "Rust",
  go:         "Go",
  java:       "Java / Kotlin",
  css:        "CSS / SCSS",
  html:       "HTML",
  json:       "JSON / YAML / TOML",
  markdown:   "Markdown",
  other:      "Other",
};

function languageOfEntity(e: Entity): LanguageKey {
  const m = e.name.match(/\.([a-z0-9]+)$/i);
  const ext = m?.[1]?.toLowerCase() ?? "";
  return LANGUAGE_OF_EXT[ext] ?? "other";
}

interface TopFile {
  entity: Entity;
  loc: number;
  language: LanguageKey;
}

function collectTopFilesByLang(ctx: ViewContextValue): Map<LanguageKey, TopFile[]> {
  const byLang = new Map<LanguageKey, TopFile[]>();
  if (!ctx.tree) return byLang;
  for (const e of ctx.tree.byId.values()) {
    if (e.kind !== "building") continue;
    const lang = languageOfEntity(e);
    const loc = e.metrics?.loc ?? 100;
    const arr = byLang.get(lang) ?? [];
    arr.push({ entity: e, loc, language: lang });
    byLang.set(lang, arr);
  }
  for (const [, arr] of byLang) arr.sort((a, b) => b.loc - a.loc);
  return byLang;
}

function LanguageBreakdownViewImpl({ ctx }: Props): ReactElement | null {
  const stats: LanguageStat[] = useMemo(
    () => (ctx.tree ? languageBreakdown(ctx.tree) : []),
    [ctx.tree],
  );

  const topByLang = useMemo(() => collectTopFilesByLang(ctx), [ctx]);

  const totalLoc = useMemo(() => stats.reduce((acc, s) => acc + s.loc, 0), [stats]);
  const totalFiles = useMemo(() => stats.reduce((acc, s) => acc + s.files, 0), [stats]);

  const topFiles: TopFile[] = useMemo(() => {
    // Top-10 across the whole repo, interleaving languages for variety.
    const arr: TopFile[] = [];
    for (const [, list] of topByLang) arr.push(...list);
    arr.sort((a, b) => b.loc - a.loc);
    return arr.slice(0, 12);
  }, [topByLang]);

  if (stats.length === 0 || totalLoc === 0) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: font.size.md, color: color.text3 }}>언어 데이터가 없습니다.</div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>Languages</div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            {stats.length}개 언어 · {totalFiles.toLocaleString()} files · {totalLoc.toLocaleString()} LoC
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3 }}>
          GitHub Linguist · repo language bar
        </div>
      </header>

      {/* Full-width stacked language bar */}
      <div style={stackBarWrap}>
        <div style={stackBarBase}>
          {stats.map((s, i) => {
            const share = s.loc / totalLoc;
            if (share < 0.005) return null;
            return (
              <div
                key={s.language}
                title={`${LANGUAGE_LABEL[s.language]} · ${(share * 100).toFixed(1)}%`}
                style={{
                  width: `${share * 100}%`,
                  background: LANGUAGE_COLOR[s.language],
                  height: "100%",
                  animation: `lb-bar 520ms ${ENTRY_EASE} both`,
                  animationDelay: `${i * 22}ms`,
                  transformOrigin: "left center",
                }}
              />
            );
          })}
        </div>
      </div>

      <div style={mainStyle}>
        <div style={legendWrapStyle}>
          <div style={sectionLabelStyle}>Legend</div>
          <div style={legendGridStyle}>
            {stats.map((s, i) => {
              const share = s.loc / totalLoc;
              return (
                <div
                  key={s.language}
                  style={{
                    ...legendItemStyle,
                    animationDelay: `${i * 18}ms`,
                  }}
                >
                  <span style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: LANGUAGE_COLOR[s.language],
                    flexShrink: 0,
                    boxShadow: `0 0 0 2px ${LANGUAGE_COLOR[s.language]}22`,
                  }} />
                  <span style={legendNameStyle}>{LANGUAGE_LABEL[s.language]}</span>
                  <span style={legendPctStyle}>{(share * 100).toFixed(1)}%</span>
                  <span style={legendMetaStyle}>{s.files.toLocaleString()} files</span>
                  <span style={legendLocStyle}>{s.loc.toLocaleString()} LoC</span>
                </div>
              );
            })}
          </div>
        </div>

        <aside style={topFilesStyle}>
          <div style={sectionLabelStyle}>Top language files</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {topFiles.map((tf, i) => (
              <button
                key={tf.entity.id}
                type="button"
                onClick={() => ctx.dispatch.selectEntity(tf.entity.id)}
                style={{
                  ...topRowStyle,
                  animationDelay: `${i * 18}ms`,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = color.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: LANGUAGE_COLOR[tf.language],
                  flexShrink: 0,
                }} />
                <span style={topFileNameStyle}>{tf.entity.name}</span>
                <span style={{ flex: 1 }} />
                <span style={topLocStyle}>{tf.loc.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `lb-enter 520ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: space[4],
};

const stackBarWrap: CSSProperties = {
  width: "100%",
  marginBottom: space[5],
};

const stackBarBase: CSSProperties = {
  display: "flex",
  width: "100%",
  height: 14,
  borderRadius: radius.pill,
  overflow: "hidden",
  background: color.bg3,
  border: `1px solid ${color.border}`,
};

const mainStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 320px",
  gap: space[4],
  alignItems: "start",
};

const legendWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
  minWidth: 0,
};

const legendGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: space[2],
};

const sectionLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  marginBottom: space[2],
};

const legendItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: `lb-row 440ms ${ENTRY_EASE} both`,
  fontSize: font.size.xs,
};

const legendNameStyle: CSSProperties = {
  color: color.text0,
  fontWeight: font.weight.medium,
  flexShrink: 1,
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const legendPctStyle: CSSProperties = {
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
  color: color.text0,
  fontVariantNumeric: "tabular-nums",
  marginLeft: "auto",
  flexShrink: 0,
};

const legendMetaStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text2,
  flexShrink: 0,
  fontVariantNumeric: "tabular-nums",
};

const legendLocStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  flexShrink: 0,
  fontVariantNumeric: "tabular-nums",
};

const topFilesStyle: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  minWidth: 0,
};

const topRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[1]}px ${space[2]}px`,
  background: "transparent",
  border: 0,
  borderBottom: `1px solid ${color.borderSoft}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: `lb-row 420ms ${ENTRY_EASE} both`,
  minWidth: 0,
};

const topFileNameStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
  flexShrink: 1,
};

const topLocStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text2,
  fontVariantNumeric: "tabular-nums",
  flexShrink: 0,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const LanguageBreakdownView = memo(LanguageBreakdownViewImpl);
