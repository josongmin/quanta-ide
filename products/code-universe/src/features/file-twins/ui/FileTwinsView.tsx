// FileTwinsView — nearest-neighbour similar files.
// --------------------------------------------------------------------
// Reference: Zhou & Wong, "Supporting software maintenance through
// structural clustering" (ISSRE 2008).
// Renders the top-K most similar files to the selected file as cards.
// Each card: similarity % · reason tag (이름 유사 / co-change / 구조
// 유사) · file name · relative path · LoC. Clicking a card re-focuses
// the selection so the user can "walk" through the cluster.
//
// The reason tag picks the dominant component of the composite
// similarity so "why is this a twin?" is always answered — surfaces
// the single feature the match is riding on.

import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import { fileTwins } from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const KEYFRAMES = `
@keyframes ft-enter {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes ft-card {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
`;

function reasonTint(reason: string): { bg: string; fg: string } {
  switch (reason) {
    case "이름 유사":  return { bg: "#dbeafe", fg: "#1e40af" };
    case "co-change":  return { bg: "#fef3c7", fg: "#92400e" };
    case "구조 유사":
    default:           return { bg: "#d1fae5", fg: "#065f46" };
  }
}

function FileTwinsViewImpl({ ctx, entity, empty }: Props): ReactElement {
  const twins = useMemo(() => {
    if (!entity || !ctx.tree) return [];
    const pool = [...ctx.tree.byId.values()];
    return fileTwins(entity, pool, 8);
  }, [entity, ctx.tree]);

  if (empty || !entity) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하세요.</div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Twins · <span style={fileNameStyle}>{entity.name}</span></div>
          <div style={subtitleStyle}>
            {twins.length} similar files · composite = name × structural × co-change
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3 }}>
          Zhou & Wong (ISSRE 2008)
        </div>
      </header>

      {twins.length === 0 ? (
        <div style={noTwinsStyle}>
          이 파일과 유사한 파일을 찾지 못했습니다.
        </div>
      ) : (
        <div style={gridStyle}>
          {twins.map((t, i) => {
            const simPct = Math.round(t.similarity * 100);
            const tone = reasonTint(t.reason);
            const loc = t.entity.metrics?.loc ?? "—";
            return (
              <button
                key={t.entity.id}
                type="button"
                onClick={() => ctx.dispatch.selectEntity(t.entity.id)}
                style={{
                  ...cardStyle,
                  animationDelay: `${60 + i * 18}ms`,
                }}
              >
                <div style={cardHeadStyle}>
                  <div style={simBlockStyle}>
                    <span style={simNumberStyle}>{simPct}</span>
                    <span style={simLabelStyle}>%</span>
                  </div>
                  <span
                    style={{
                      ...reasonPillStyle,
                      background: tone.bg,
                      color: tone.fg,
                    }}
                  >
                    {t.reason}
                  </span>
                </div>
                <div style={cardNameStyle}>{t.entity.name}</div>
                <div style={cardPathStyle} title={t.entity.path}>
                  {t.entity.path}
                </div>
                <div style={cardMetaStyle}>
                  <span style={metaPillStyle}>{loc} LoC</span>
                  <span style={metaPillStyle}>{t.entity.kind}</span>
                  <SimBar value={t.similarity} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SimBar({ value }: { value: number }): ReactElement {
  return (
    <span style={simBarWrap}>
      <span
        style={{
          ...simBarFill,
          width: `${Math.max(4, Math.min(100, value * 100))}%`,
        }}
      />
    </span>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[5]}px ${space[6]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `ft-enter 520ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
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
  borderRadius: radius.lg,
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

const noTwinsStyle: CSSProperties = {
  padding: space[5],
  color: color.text2,
  fontSize: font.size.sm,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  textAlign: "center",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: space[3],
};

const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  animation: `ft-card 520ms ${ENTRY_EASE} both`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  color: "inherit",
  transition: `box-shadow ${transition.base}, border-color ${transition.base}, transform ${transition.fast}`,
};

const cardHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const simBlockStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 2,
};

const simNumberStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: 26,
  fontWeight: font.weight.bold,
  color: color.accent,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.4,
  lineHeight: 1,
};

const simLabelStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.sm,
  color: color.text2,
  fontWeight: font.weight.medium,
};

const reasonPillStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  fontWeight: font.weight.semibold,
  padding: `2px 8px`,
  borderRadius: radius.pill,
  whiteSpace: "nowrap",
};

const cardNameStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.md,
  color: color.text0,
  fontWeight: font.weight.medium,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const cardPathStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const cardMetaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[1],
  marginTop: 2,
};

const metaPillStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  padding: `1px 6px`,
  background: color.bg3,
  color: color.text2,
  borderRadius: radius.sm,
};

const simBarWrap: CSSProperties = {
  flex: 1,
  marginLeft: space[1],
  height: 4,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
  display: "inline-block",
};

const simBarFill: CSSProperties = {
  display: "block",
  height: "100%",
  background: color.accent,
  borderRadius: radius.pill,
  transition: `width ${transition.base}`,
};

export const FileTwinsView = memo(FileTwinsViewImpl);
