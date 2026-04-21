import type { CSSProperties, ReactElement } from "react";
import type { Entity, EntityTree } from "@quanta/canvas-engine";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import { QUESTIONS, applyQuestion, isQuestionApplicable } from "../model/questions";

// AnalyzePanel — Inspector section that converts the currently-
// selected entity into a LIST OF QUESTIONS the user can click. Each
// click auto-configures the canvas (view mode + focus + scope) so the
// answer materialises in one gesture. This is the primary discovery
// surface — the view picker in the toolbar is a power-user shortcut;
// most of the time the user should be able to get their question
// answered by clicking a question here.

interface AnalyzePanelProps {
  entity: Entity;
  tree: EntityTree;
}

const ROOT: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const HEADER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  color: color.text2,
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  textTransform: "uppercase",
  letterSpacing: font.letter.ultra,
  marginBottom: space[1],
};

const BUTTON_BASE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 2,
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  textAlign: "left",
  fontFamily: font.sans,
  cursor: "pointer",
  transition: "background 120ms, border-color 120ms, transform 120ms",
  color: color.text0,
};

const BUTTON_HOVER: CSSProperties = {
  background: color.bg1,
  borderColor: color.borderStrong,
};

const LABEL: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  lineHeight: 1.3,
};

const HINT: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text3,
  lineHeight: 1.35,
  letterSpacing: -0.03,
};

export function AnalyzePanel({ entity, tree }: AnalyzePanelProps): ReactElement {
  return (
    <section
      data-inspector-section="analyze"
      data-inspector-state="ready"
      style={ROOT}
    >
      <div style={HEADER}>
        <span>Analyze</span>
        <span
          style={{
            flex: 1,
            height: 1,
            background: color.border,
            opacity: 0.6,
          }}
          aria-hidden
        />
      </div>
      {QUESTIONS.map(q => {
        const applicable = isQuestionApplicable(q, entity.kind);
        return (
          <button
            key={q.id}
            type="button"
            disabled={!applicable}
            onClick={() => applyQuestion(q.id, entity, tree)}
            onMouseEnter={e => {
              if (!applicable) return;
              Object.assign(e.currentTarget.style, BUTTON_HOVER);
            }}
            onMouseLeave={e => {
              if (!applicable) return;
              e.currentTarget.style.background = BUTTON_BASE.background as string;
              e.currentTarget.style.borderColor = BUTTON_BASE.border?.toString().split(" ")[2] ?? color.border;
            }}
            style={{
              ...BUTTON_BASE,
              opacity: applicable ? 1 : 0.45,
              cursor: applicable ? "pointer" : "not-allowed",
            }}
            data-question-id={q.id}
            data-question-state={applicable ? "ready" : "not-applicable"}
            title={applicable ? q.hint : `${q.hint} — not applicable to ${entity.kind}`}
          >
            <span style={LABEL}>{q.label}</span>
            <span style={HINT}>{q.hint}</span>
          </button>
        );
      })}
    </section>
  );
}
