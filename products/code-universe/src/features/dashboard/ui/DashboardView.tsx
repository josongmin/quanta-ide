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
import { ConfidenceChip, TierChip, bucketColor } from "./primitives";

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

const TABS: { id: DashboardTab; label: string; caption: string; accent: string }[] = [
  { id: "repo-health", label: "Repo Health",     caption: "L2 · baseline",  accent: color.accent },
  { id: "this-change", label: "This Change",     caption: "L3 · delta",     accent: "#e09321"    },
  { id: "team-flow",   label: "Team Flow",       caption: "L1 · delivery",  accent: "#22a06b"    },
  { id: "governance",  label: "Governance",      caption: "L5 · verdict",   accent: "#9e77ff"    },
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

  const baselineTone =
    repoHealth.baselineRisk.bucket === "low" ? "Safe"
    : repoHealth.baselineRisk.bucket === "medium" ? "Attention"
    : "Intervene";

  return (
    <div style={{ ...WRAP, width, height }}>
      {/* Header — Gemini Console style: title + attached Tier chip on
          left, verdict + close on right. Project/period controls live
          in the filter strip below. */}
      <header style={HEADER}>
        <div style={HEADER_LEFT}>
          <h1 style={TITLE}>
            Dashboard
            <TierChip label={`Baseline ${repoHealth.baselineRisk.score} · ${baselineTone}`} accent={bucketColor(repoHealth.baselineRisk.bucket)} />
          </h1>
          <div style={SUBTITLE}>Repo intelligence · Flow · Verdict · all in one view</div>
        </div>

        <div style={HEADER_RIGHT}>
          {/* Verdict stamp — clickable, jumps to governance */}
          <button
            type="button"
            onClick={() => setActive("governance")}
            style={{
              ...VERDICT_STAMP,
              borderColor: `${verdictAccent}55`,
              color: verdictAccent,
            }}
          >
            <span style={{ ...VERDICT_DOT, background: verdictAccent }} />
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

      {/* Filter strip — project + period, Gemini-style */}
      <div style={FILTER_STRIP}>
        <label style={FILTER_FIELD}>
          <span style={FILTER_LABEL}>Project</span>
          <span style={FILTER_CONTROL}>{scope.name}</span>
        </label>
        <label style={FILTER_FIELD}>
          <span style={FILTER_LABEL}>Scope</span>
          <span style={FILTER_CONTROL}>{scope.kind}</span>
        </label>
      </div>

      {/* Tab bar — underline accent, no boxed chrome */}
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
                if (!isActive) e.currentTarget.style.color = color.text0;
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.color = color.text2;
              }}
              style={{
                ...TAB_BTN,
                color: isActive ? color.text0 : color.text2,
                boxShadow: isActive ? `inset 0 -2px 0 ${color.text0}` : "inset 0 -2px 0 transparent",
              }}
            >
              <span style={TAB_LABEL_TEXT}>{t.label}</span>
              <span style={TAB_CAPTION}>{t.caption}</span>
              <span style={TAB_KEY}>{i + 1}</span>
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
  background: "#ffffff",
  overflow: "hidden",
  fontFamily: font.sans,
};

const HEADER: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: space[4],
  padding: `${space[5]}px ${CONTENT_PAD_X}px ${space[3]}px`,
  background: "#ffffff",
};

const HEADER_LEFT: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
};

const HEADER_RIGHT: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
};

const TITLE: CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: font.weight.bold,
  letterSpacing: -0.6,
  color: color.text0,
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
};

const SUBTITLE: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text2,
  letterSpacing: 0,
};

const VERDICT_STAMP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "4px 12px 4px 10px",
  border: "1px solid",
  borderRadius: radius.pill,
  background: "#ffffff",
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
  width: 30,
  height: 30,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: "#ffffff",
  color: color.text1,
  fontSize: 18,
  cursor: "pointer",
  lineHeight: 1,
  fontFamily: font.sans,
};

// Filter strip below the header. Label + value pairs rendered as
// tiny bordered capsules, matching the Gemini "프로젝트 [Gemini API ▾]"
// control strip. No interactivity yet — the scope is driven by the
// canvas selection, so these are read-only badges for now.
const FILTER_STRIP: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `0 ${CONTENT_PAD_X}px ${space[3]}px`,
  background: "#ffffff",
};

const FILTER_FIELD: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const FILTER_LABEL: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: 0,
};

const FILTER_CONTROL: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 12px",
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  background: "#ffffff",
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
  letterSpacing: 0,
  textTransform: "capitalize",
};

const TAB_BAR: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  gap: space[5],
  padding: `0 ${CONTENT_PAD_X}px`,
  background: "#ffffff",
  borderBottom: `1px solid ${color.border}`,
};

const TAB_BTN: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[3]}px 0`,
  marginBottom: -1,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  transition: "color 140ms, box-shadow 140ms",
  fontFamily: font.sans,
  position: "relative",
};

const TAB_LABEL_TEXT: CSSProperties = {
  fontSize: font.size.lg,
  fontWeight: font.weight.semibold,
  letterSpacing: -0.1,
};

const TAB_CAPTION: CSSProperties = {
  fontSize: 10,
  color: color.text3,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  fontFamily: font.sans,
};

const TAB_KEY: CSSProperties = {
  fontSize: 9.5,
  fontFamily: font.mono,
  padding: "1px 6px",
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  fontWeight: font.weight.semibold,
  color: color.text3,
};

const BODY: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  padding: `${space[5]}px ${CONTENT_PAD_X}px`,
  background: "#ffffff",
};
