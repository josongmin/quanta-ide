// ReviewRecommenderView — ranked reviewer candidates for a changed set.
// --------------------------------------------------------------------
// Mirrors PR-review-suggestion tooling (GitHub CODEOWNERS fallback,
// Google's internal review-router, and Microsoft's ReviewBot): given a
// "changed set" of files, surface the developers with the strongest
// past-blame × area-expertise × recent-activity signal.
//
// References (see also view.tsx header):
//   Xie et al. "ReviewBot" (MSR 2015)
//   Ying et al. "Predicting source code changes" (FSE 2004)
//   Google Code Review reviewer suggestion (2018).
//
// Layout:
//   ── header + paper citation ──
//   ── "demo set" card (the synthesized changed files) ──
//   ── ranked candidate rows (avatar · name · score bar · chips · areas) ──
//   ── bottom action: "이 N명에게 리뷰 요청" (stub) ──
//
// All colours pull from tokens; avatar hue comes from authorHue(authorId)
// (HSL), which is the one place we derive a non-token colour — per the
// author-hue shared convention.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  radius as radiusToken,
  space,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  authorHue,
  churn,
  recommendReviewers,
  type ReviewerCandidate,
} from "../../../shared/analytics/synth-metrics";

export interface ReviewRecommenderViewProps {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;

const KEYFRAMES = `
@keyframes rrFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes rrItemIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes rrBarGrow {
  from { width: 0%; }
  to   { width: var(--rr-bar-target); }
}
`;

/** Build a synthesized "changed files" set from the current ctx. */
function buildChangedSet(ctx: ViewContextValue): Entity[] {
  const tree = ctx.tree;
  if (!tree) return [];
  const out: Entity[] = [];
  if (ctx.selectedId) {
    const sel = tree.byId.get(ctx.selectedId);
    if (sel) {
      // Walk up until we find a file/folder to anchor on.
      let anchor: Entity | null = sel;
      if (anchor.kind === "floor" || anchor.kind === "room") {
        // drill up to the containing file
        let cursor: Entity | null = anchor;
        while (cursor && cursor.kind !== "building" && cursor.parentId) {
          cursor = tree.byId.get(cursor.parentId) ?? null;
        }
        if (cursor) anchor = cursor;
      }
      if (anchor && anchor.kind === "building") out.push(anchor);
      // Add up to 7 sibling files via parent.childrenOf.
      const parentId = anchor?.parentId;
      if (parentId) {
        const siblings = tree.childrenOf(parentId);
        for (const s of siblings) {
          if (s.kind !== "building") continue;
          if (s.id === anchor?.id) continue;
          out.push(s);
          if (out.length >= 8) break;
        }
      }
    }
  }
  if (out.length === 0) {
    // Fallback: top 5 by churn.
    const all: Array<{ e: Entity; c: number }> = [];
    for (const e of tree.byId.values()) {
      if (e.kind !== "building") continue;
      all.push({ e, c: churn(e) });
    }
    all.sort((a, b) => b.c - a.c);
    for (const { e } of all.slice(0, 5)) out.push(e);
  }
  return out.slice(0, 8);
}

function ReviewRecommenderViewImpl({ ctx }: ReviewRecommenderViewProps): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dispatched, setDispatched] = useState(false);
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const changedSet = useMemo(() => buildChangedSet(ctx), [ctx]);
  const candidates = useMemo<ReviewerCandidate[]>(() => {
    if (!ctx.tree || changedSet.length === 0) return [];
    const ids = changedSet.map(e => e.id);
    const all = recommendReviewers(ids, ctx.tree);
    return all.slice(0, 6);
  }, [ctx.tree, changedSet]);

  if (!ctx.tree || candidates.length === 0) {
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
        리뷰어 추천 데이터가 아직 없어요
      </div>
    );
  }

  const rootStyle: CSSProperties = {
    animation: `rrFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center top",
    padding: "40px 48px 32px 48px",
    boxSizing: "border-box",
    height: "100%",
    overflowY: "auto",
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
        <div style={{ marginBottom: space[4] }}>
          <div
            style={{
              fontSize: font.size.xxl,
              fontWeight: font.weight.bold,
              color: tokenColor.text0,
              letterSpacing: font.letter.tight,
            }}
          >
            Review Recommender
          </div>
          <div
            style={{
              fontSize: font.size.xs,
              color: tokenColor.text2,
              marginTop: 4,
            }}
          >
            리뷰어 추천 — 과거 기여 × 영역 전문성 × 최근 활성도 · ReviewBot MSR 2015
          </div>
        </div>

        {/* Demo changed-set card */}
        <div
          style={{
            background: tokenColor.bg2,
            border: `1px solid ${tokenColor.border}`,
            borderRadius: radiusToken.md,
            padding: `${space[3]}px ${space[4]}px`,
            marginBottom: space[4],
            animation: `rrItemIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          }}
        >
          <div
            style={{
              fontSize: font.size.xxs,
              color: tokenColor.text2,
              textTransform: "uppercase",
              letterSpacing: font.letter.ultra,
              marginBottom: space[2],
            }}
          >
            Demo changed set · {changedSet.length} files
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: space[1],
              alignItems: "center",
            }}
          >
            {changedSet.map(e => (
              <div
                key={e.id}
                title={e.path}
                style={{
                  fontFamily: font.mono,
                  fontSize: font.size.xxs,
                  background: tokenColor.bg3,
                  color: tokenColor.text1,
                  padding: `2px ${space[2]}px`,
                  borderRadius: radiusToken.pill,
                  border: `1px solid ${tokenColor.borderSoft}`,
                  whiteSpace: "nowrap",
                  maxWidth: 220,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {e.name}
              </div>
            ))}
          </div>
        </div>

        {/* Column legend */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 180px 200px",
            columnGap: space[3],
            fontSize: font.size.xxs,
            color: tokenColor.text2,
            paddingBottom: space[1],
            borderBottom: `1px solid ${tokenColor.border}`,
            marginBottom: space[1],
            textTransform: "uppercase",
            letterSpacing: font.letter.ultra,
          }}
        >
          <div>Reviewer · Expertise</div>
          <div>Activity</div>
          <div>Match score</div>
        </div>

        {/* Candidate rows */}
        {candidates.map((cand, i) => {
          const isHovered = hoveredId === cand.author;
          const scorePct = Math.round(cand.score * 100);
          const hue = authorHue(cand.author);
          const avatarBg = `hsl(${hue} 62% 52%)`;
          const barColor = scoreColor(cand.score);
          const initials = cand.author.slice(0, 2).toUpperCase();

          const rowStyle: CSSProperties = {
            display: "grid",
            gridTemplateColumns: "1fr 180px 200px",
            columnGap: space[3],
            alignItems: "center",
            padding: `${space[3]}px ${space[2]}px`,
            borderRadius: radiusToken.md,
            background: isHovered ? tokenColor.hover : "transparent",
            cursor: "default",
            transition: `background 180ms ease-out, transform 180ms ease-out`,
            transform: isHovered ? "scale(1.005)" : "scale(1)",
            transformOrigin: "left center",
            animation: `rrItemIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
            animationDelay: `${80 + Math.min(i * STAGGER_MS, 400)}ms`,
            borderBottom: `1px solid ${tokenColor.borderSoft}`,
          };

          return (
            <div
              key={cand.author}
              style={rowStyle}
              onMouseEnter={() => setHoveredId(cand.author)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Avatar + name + expertise tags */}
              <div style={{ display: "flex", alignItems: "center", gap: space[3], minWidth: 0 }}>
                <div
                  aria-hidden
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: avatarBg,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: font.size.md,
                    fontWeight: font.weight.semibold,
                    letterSpacing: font.letter.wide,
                    flexShrink: 0,
                    border: `2px solid ${tokenColor.bg0}`,
                    boxShadow: `0 0 0 1px hsl(${hue} 62% 42% / 0.3)`,
                  }}
                >
                  {initials}
                </div>
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      fontSize: font.size.lg,
                      fontWeight: font.weight.semibold,
                      color: tokenColor.text0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {cand.author}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                      marginTop: 3,
                    }}
                  >
                    {cand.expertise.length === 0 ? (
                      <span
                        style={{
                          fontSize: font.size.xxs,
                          color: tokenColor.text3,
                          fontStyle: "italic",
                        }}
                      >
                        no primary area
                      </span>
                    ) : (
                      cand.expertise.map(area => (
                        <span
                          key={area}
                          style={{
                            fontFamily: font.mono,
                            fontSize: font.size.xxs,
                            color: tokenColor.text1,
                            background: tokenColor.bg3,
                            padding: `1px ${space[2]}px`,
                            borderRadius: radiusToken.pill,
                            border: `1px solid ${tokenColor.borderSoft}`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {area}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Activity chips */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  fontSize: font.size.xxs,
                  color: tokenColor.text2,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span>
                  <span style={{ color: tokenColor.text0, fontWeight: font.weight.semibold }}>
                    {cand.recentCommits}
                  </span>{" "}
                  recent commits
                </span>
                <span>
                  <span style={{ color: tokenColor.text0, fontWeight: font.weight.semibold }}>
                    {cand.touchedFiles}
                  </span>{" "}
                  touched files
                </span>
                <span>
                  last active{" "}
                  <span style={{ color: tokenColor.text0, fontWeight: font.weight.semibold }}>
                    {cand.lastActiveDaysAgo}d
                  </span>{" "}
                  ago
                </span>
              </div>

              {/* Score bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: space[2],
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: radiusToken.pill,
                    background: tokenColor.bg3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      // animate via CSS var so width:0 → final via keyframe
                      ["--rr-bar-target" as string]: `${scorePct}%`,
                      width: `${scorePct}%`,
                      height: "100%",
                      background: barColor,
                      borderRadius: radiusToken.pill,
                      animation: `rrBarGrow 560ms ${ENTRY_EASE} both`,
                      animationDelay: `${180 + Math.min(i * STAGGER_MS, 400)}ms`,
                    } as CSSProperties}
                  />
                </div>
                <div
                  style={{
                    fontSize: font.size.md,
                    fontWeight: font.weight.bold,
                    color: tokenColor.text0,
                    fontVariantNumeric: "tabular-nums",
                    minWidth: 38,
                    textAlign: "right",
                  }}
                >
                  {scorePct}
                </div>
              </div>
            </div>
          );
        })}

        {/* Bottom action */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: space[5],
            paddingTop: space[4],
            borderTop: `1px solid ${tokenColor.border}`,
          }}
        >
          <div
            style={{
              fontSize: font.size.xxs,
              color: tokenColor.text3,
            }}
          >
            past blame × area × recency · top {candidates.length} of pool
          </div>
          <button
            type="button"
            onClick={() => setDispatched(true)}
            disabled={dispatched}
            style={{
              fontFamily: font.sans,
              fontSize: font.size.md,
              fontWeight: font.weight.semibold,
              color: dispatched ? tokenColor.text2 : "#fff",
              background: dispatched ? tokenColor.bg3 : tokenColor.accent,
              border: `1px solid ${dispatched ? tokenColor.border : tokenColor.accent}`,
              borderRadius: radiusToken.md,
              padding: `${space[2]}px ${space[4]}px`,
              cursor: dispatched ? "default" : "pointer",
              transition: `background 180ms ease-out, color 180ms ease-out`,
            }}
          >
            {dispatched
              ? `요청 전송됨 — ${candidates.length}명`
              : `이 ${candidates.length}명에게 리뷰 요청`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Neutral → success gradient for score bar. */
function scoreColor(score: number): string {
  if (score >= 0.66) return tokenColor.success;
  if (score >= 0.33) return tokenColor.accent;
  return tokenColor.warn;
}

export const ReviewRecommenderView = memo(ReviewRecommenderViewImpl);
