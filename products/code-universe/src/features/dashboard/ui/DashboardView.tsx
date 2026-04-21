import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import { useEntityState } from "../../../entities/entity";
import { computeRepoHealth } from "../model/compute-repo-health";
import { computeThisChange } from "../model/compute-this-change";
import { computeTeamFlow } from "../model/compute-team-flow";
import { computeGovernance } from "../model/compute-governance";
import type { ChangeScope, DashboardTab } from "../model/types";
import { RepoHealthTab } from "./RepoHealthTab";
import { ThisChangeTab } from "./ThisChangeTab";
import { TeamFlowTab } from "./TeamFlowTab";
import { GovernanceTab } from "./GovernanceTab";
import { ConfidenceChip, bucketColor } from "./primitives";

// DashboardView — 4-tab metric surface.
// --------------------------------------------------------------------
// Top layout:
//   ┌ header — title · scope · verdict stamp · close ┐
//   ├ tab bar: Repo Health / This Change / Team Flow / Governance ┤
//   │
//   │ active tab's scroll region
//   │
//   └─────────────────────────────────────────────────────────────┘
//
// Verdict stamp is persistent across tabs — it's the IDE's governance
// identity. Clicking it jumps to the Governance tab.

export interface DashboardViewProps {
  graph: WorkspaceGraph;
  width: number;
  height: number;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

const TABS: { id: DashboardTab; label: string; caption: string; accent: string; glyph: string }[] = [
  { id: "repo-health", label: "Repo Health",     caption: "L2 · baseline",  accent: color.accent, glyph: "◎" },
  { id: "this-change", label: "This Change",     caption: "L3 · delta",     accent: "#e09321",    glyph: "⚡" },
  { id: "team-flow",   label: "Team Flow",       caption: "L1 · delivery",  accent: "#22a06b",    glyph: "⧈" },
  { id: "governance",  label: "Governance",      caption: "L5 · verdict",   accent: "#9e77ff",    glyph: "⊞" },
];

export const DashboardView = memo(function DashboardView(props: DashboardViewProps): ReactElement {
  const { graph, width, height, onFocusEntity, onDismiss } = props;
  const [active, setActive] = useState<DashboardTab>("repo-health");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset scroll on tab switch
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [active]);

  // ── Scope resolution (for "This Change" tab + header) ──────────────
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const anchorId   = useEntityState(s => s.interaction.anchorId);
  const tree       = useEntityState(s => s.tree);

  const scope: ChangeScope = useMemo(() => {
    const id = anchorId ?? selectedId ?? null;
    if (!id) return { id: null, kind: "repo", name: "Workspace", path: "" };
    const entity = tree?.byId.get(id);
    if (!entity) return { id: null, kind: "repo", name: "Workspace", path: "" };
    let kind: ChangeScope["kind"] = "repo";
    if (entity.kind === "street") kind = "folder";
    else if (entity.kind === "building") kind = "file";
    else if (entity.kind === "floor" || entity.kind === "room") kind = "symbol";
    return { id, kind, name: entity.name, path: entity.path ?? "" };
  }, [anchorId, selectedId, tree]);

  // ── Heavy computes (memoized per tab) ──────────────────────────────
  const repoHealth = useMemo(() => computeRepoHealth(graph), [graph]);
  const thisChange = useMemo(() => computeThisChange({ graph, scope }), [graph, scope]);
  const teamFlow   = useMemo(() => computeTeamFlow({ graph, now: Date.now() }), [graph]);
  const governance = useMemo(() => computeGovernance({ graph, now: Date.now() }), [graph]);

  const verdictAccent: string = {
    PASS:   color.success,
    HOLD:   color.warn,
    BLOCK:  color.danger,
    REVIEW: color.accent,
  }[governance.verdict.decision];

  // ── Keyboard: Esc to dismiss, 1-4 to switch tabs ───────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && onDismiss) {
        onDismiss();
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "1") setActive("repo-health");
      if (e.key === "2") setActive("this-change");
      if (e.key === "3") setActive("team-flow");
      if (e.key === "4") setActive("governance");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  // ── Content width (tab region has internal padding) ────────────────
  const contentWidth = Math.max(400, width - CONTENT_PAD_X * 2);

  const onFocusFile = useCallback((id: string) => {
    if (onFocusEntity) onFocusEntity(id);
  }, [onFocusEntity]);

  return (
    <div style={{ ...WRAP, width, height }}>
      {/* Header */}
      <header style={HEADER}>
        <div style={HEADER_LEFT}>
          <div style={TITLE_GLYPH_ROW}>
            <span style={TITLE_GLYPH}>⎈</span>
            <div>
              <h1 style={TITLE}>Dashboard</h1>
              <div style={SUBTITLE}>Repo intelligence · Flow · Verdict · all in one view</div>
            </div>
          </div>
        </div>

        <div style={HEADER_RIGHT}>
          {/* Baseline risk chip */}
          <div style={BASELINE_CHIP}>
            <span style={{ ...BASELINE_DOT, background: bucketColor(repoHealth.baselineRisk.bucket) }} />
            <span style={BASELINE_LABEL}>BASELINE</span>
            <span style={{ ...BASELINE_VALUE, color: bucketColor(repoHealth.baselineRisk.bucket) }}>
              {repoHealth.baselineRisk.score}
            </span>
          </div>

          {/* Verdict stamp — clickable, jumps to governance */}
          <button
            type="button"
            onClick={() => setActive("governance")}
            style={{
              ...VERDICT_STAMP,
              background: `linear-gradient(135deg, ${verdictAccent}1f 0%, ${verdictAccent}0a 100%)`,
              borderColor: `${verdictAccent}66`,
              color: verdictAccent,
            }}
          >
            <span style={{ ...VERDICT_DOT, background: verdictAccent, boxShadow: `0 0 0 3px ${verdictAccent}22` }} />
            <span style={VERDICT_LABEL}>{governance.verdict.decision}</span>
            <ConfidenceChip confidence={governance.verdict.confidence} size="sm" />
          </button>

          {onDismiss ? (
            <button type="button" style={CLOSE_BTN} onClick={onDismiss} title="Close (Esc)">
              ×
            </button>
          ) : null}
        </div>
      </header>

      {/* Tab bar */}
      <nav style={TAB_BAR} role="tablist">
        {TABS.map((t, i) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = color.bg2;
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
              style={{
                ...TAB_BTN,
                background: isActive ? color.bg1 : "transparent",
                borderColor: isActive ? color.border : "transparent",
                borderBottomColor: isActive ? color.bg1 : "transparent",
                color: isActive ? color.text0 : color.text2,
                boxShadow: isActive ? `inset 0 2px 0 ${t.accent}` : "none",
              }}
            >
              <span style={{ ...TAB_GLYPH, color: isActive ? t.accent : color.text3 }}>{t.glyph}</span>
              <span style={TAB_LABEL_COL}>
                <span style={TAB_LABEL_TEXT}>{t.label}</span>
                <span style={TAB_CAPTION}>{t.caption}</span>
              </span>
              <span style={{ ...TAB_KEY, color: color.text3 }}>{i + 1}</span>
            </button>
          );
        })}
      </nav>

      {/* Body */}
      <div ref={scrollRef} style={BODY}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>
          {active === "repo-health" ? (
            <RepoHealthTab data={repoHealth} width={contentWidth} onFocusFile={onFocusFile} />
          ) : null}
          {active === "this-change" ? (
            <ThisChangeTab data={thisChange} width={contentWidth} onFocusFile={onFocusFile} />
          ) : null}
          {active === "team-flow" ? (
            <TeamFlowTab data={teamFlow} width={contentWidth} />
          ) : null}
          {active === "governance" ? (
            <GovernanceTab data={governance} width={contentWidth} />
          ) : null}
        </div>
      </div>
    </div>
  );
});

const CONTENT_PAD_X = 32;

// ── Styles ────────────────────────────────────────────────────────────

const WRAP: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg2,
  overflow: "hidden",
  fontFamily: font.sans,
};

const HEADER: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: space[4],
  padding: `${space[4]}px ${CONTENT_PAD_X}px`,
  background: color.bg1,
  borderBottom: `1px solid ${color.border}`,
};

const HEADER_LEFT: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  minWidth: 0,
};

const HEADER_RIGHT: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
};

const TITLE_GLYPH_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
};

const TITLE_GLYPH: CSSProperties = {
  fontSize: 24,
  color: color.accent,
  lineHeight: 1,
};

const TITLE: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
  color: color.text0,
};

const SUBTITLE: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: font.letter.tight,
  marginTop: 1,
};

const BASELINE_CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  borderRadius: radius.pill,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  fontSize: font.size.xs,
};

const BASELINE_DOT: CSSProperties = {
  width: 8, height: 8, borderRadius: 999,
};

const BASELINE_LABEL: CSSProperties = {
  fontWeight: font.weight.semibold,
  fontSize: 9,
  color: color.text2,
  letterSpacing: 0.5,
};

const BASELINE_VALUE: CSSProperties = {
  fontWeight: font.weight.bold,
  fontSize: font.size.md,
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
};

const VERDICT_STAMP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "4px 10px 4px 8px",
  border: "1px solid",
  borderRadius: radius.pill,
  cursor: "pointer",
  fontFamily: font.sans,
  transition: "transform 140ms, box-shadow 140ms",
};

const VERDICT_DOT: CSSProperties = {
  width: 7, height: 7, borderRadius: 999,
};

const VERDICT_LABEL: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.bold,
  letterSpacing: 0.8,
};

const CLOSE_BTN: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.bg1,
  color: color.text1,
  fontSize: 18,
  cursor: "pointer",
  lineHeight: 1,
  fontFamily: font.sans,
};

const TAB_BAR: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  gap: space[1],
  padding: `0 ${CONTENT_PAD_X}px`,
  background: color.bg2,
  borderBottom: `1px solid ${color.border}`,
};

const TAB_BTN: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[2] + 2}px ${space[3]}px`,
  marginBottom: -1,
  border: "1px solid transparent",
  borderTopLeftRadius: radius.md,
  borderTopRightRadius: radius.md,
  cursor: "pointer",
  transition: "background 140ms, color 140ms",
  fontFamily: font.sans,
  position: "relative",
};

const TAB_GLYPH: CSSProperties = {
  fontSize: 16,
  lineHeight: 1,
};

const TAB_LABEL_COL: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 1,
  lineHeight: 1.1,
};

const TAB_LABEL_TEXT: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
};

const TAB_CAPTION: CSSProperties = {
  fontSize: 9.5,
  color: color.text3,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const TAB_KEY: CSSProperties = {
  marginLeft: space[2],
  fontSize: 9,
  fontFamily: font.mono,
  padding: "1px 5px",
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  fontWeight: font.weight.semibold,
};

const BODY: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  padding: `0 ${CONTENT_PAD_X}px`,
  background: color.bg2,
  boxShadow: `inset 0 8px 16px -10px ${color.border}`,
};
