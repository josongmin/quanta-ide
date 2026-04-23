// SkillLibraryView — reusable agent skill catalog with composability graph.
// --------------------------------------------------------------------
// Top:   category filter chips (refactor / test / review / explain /
//        search / generate / verify) — single-select + "all".
// Main:  skill cards — name + category pill + description + inputs →
//        outputs arrow + avg cost + success-rate bar + usage count.
//        Click card → expanded "composable with" chip list.
// Bottom: skill-graph mini — 10 skills as nodes, composability edges
//        drawn. Hub skills (most connected) drawn larger.
// Right: "build a workflow" stub — drag skills into pipeline slots
//        (display-only, not functional).
//
// Reference:
//   - Wang et al. "Voyager" (NeurIPS 2023)
//   - AutoGen skills (Microsoft 2023)
//   - OpenAI Function Calling patterns
//   - SkillLLM (2024) — skill composition graph

import {
  memo,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  agentSkills,
  type AgentSkill,
  type SkillCategory,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;
const BAR_MS = 540;
const EDGE_MS = 900;

const KEYFRAMES = `
@keyframes sl-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes sl-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes sl-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes sl-node  { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
@keyframes sl-edge  { from { stroke-dashoffset: 200; } to { stroke-dashoffset: 0; } }
`;

const CATEGORY_ORDER: readonly SkillCategory[] = [
  "refactor", "test", "review", "explain", "search", "generate", "verify",
];

const CATEGORY_LABEL: Record<SkillCategory, string> = {
  refactor: "리팩터",
  test:     "테스트",
  review:   "리뷰",
  explain:  "설명",
  search:   "검색",
  generate: "생성",
  verify:   "검증",
};

const CATEGORY_TINT: Record<SkillCategory, string> = {
  refactor: "#7e4ed6",
  test:     color.success,
  review:   color.warn,
  explain:  color.accent,
  search:   color.text1,
  generate: "#0a7acc",
  verify:   "#d97706",
};

function fmtUsd(v: number): string {
  if (v < 0.01) return "<$0.01";
  return `$${v.toFixed(2)}`;
}

function SkillLibraryViewImpl(_props: Props): ReactElement {
  const skills = useMemo(() => agentSkills(), []);
  const [filter, setFilter] = useState<SkillCategory | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? skills : skills.filter(s => s.category === filter)),
    [skills, filter],
  );

  const counts = useMemo(() => {
    const c: Record<SkillCategory, number> = {
      refactor: 0, test: 0, review: 0, explain: 0, search: 0, generate: 0, verify: 0,
    };
    for (const s of skills) c[s.category]++;
    return c;
  }, [skills]);

  // Hub detection: degree = composableWith.length + inbound references.
  const degree = useMemo(() => {
    const d: Record<string, number> = {};
    for (const s of skills) d[s.id] = 0;
    for (const s of skills) {
      for (const other of s.composableWith) {
        d[s.id] = (d[s.id] ?? 0) + 1;
        d[other] = (d[other] ?? 0) + 1;
      }
    }
    return d;
  }, [skills]);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Skill Library</div>
          <div style={subtitleStyle}>
            {skills.length}개 skill · composable × reusable · Voyager (2023) · AutoGen · OpenAI Function Calling · SkillLLM (2024)
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, textAlign: "right" }}>
          Skill graph · Hub detection
        </div>
      </header>

      <div style={filterRowStyle}>
        <CategoryChip
          label={`전체 · ${skills.length}`}
          active={filter === "all"}
          tint={color.accent}
          onClick={() => setFilter("all")}
        />
        {CATEGORY_ORDER.map(cat => (
          <CategoryChip
            key={cat}
            label={`${CATEGORY_LABEL[cat]} · ${counts[cat]}`}
            active={filter === cat}
            tint={CATEGORY_TINT[cat]}
            onClick={() => setFilter(cat)}
          />
        ))}
      </div>

      <section style={mainGridStyle}>
        <div style={cardsColStyle}>
          <div style={sectionHeadStyle}>
            Skills {filter !== "all" && <span style={{ color: CATEGORY_TINT[filter] }}>· {CATEGORY_LABEL[filter]}</span>}
          </div>
          <div style={cardListStyle}>
            {filtered.map((skill, i) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                index={i}
                expanded={expanded === skill.id}
                onToggle={() => setExpanded(expanded === skill.id ? null : skill.id)}
                skills={skills}
              />
            ))}
          </div>
        </div>

        <aside style={workflowColStyle}>
          <div style={sectionHeadStyle}>Build a workflow</div>
          <div style={workflowStubStyle}>
            <WorkflowSlot index={0} placeholder="1. Input skill" />
            <WorkflowArrow />
            <WorkflowSlot index={1} placeholder="2. Transform" />
            <WorkflowArrow />
            <WorkflowSlot index={2} placeholder="3. Verify" />
            <div style={{
              fontSize: font.size.xxs,
              color: color.text3,
              fontFamily: font.mono,
              marginTop: space[3],
              textAlign: "center",
              lineHeight: 1.5,
            }}>
              카드를 슬롯에 드래그 (display stub)<br />
              composability 체크 자동
            </div>
          </div>
        </aside>
      </section>

      <section style={graphSectionStyle}>
        <div style={sectionHeadRowStyle}>
          <div style={sectionHeadStyle}>Skill composability graph</div>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            degree = composable edges · hubs drawn larger
          </div>
        </div>
        <SkillGraph skills={skills} degree={degree} />
      </section>
    </div>
  );
}

function CategoryChip({
  label, active, tint, onClick,
}: { label: string; active: boolean; tint: string; onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: `${space[1]}px ${space[3]}px`,
        border: `1px solid ${active ? tint : color.border}`,
        background: active ? `${tint}18` : color.bg1,
        color: active ? tint : color.text1,
        fontFamily: font.sans,
        fontSize: font.size.xs,
        fontWeight: font.weight.medium,
        borderRadius: radius.pill,
        cursor: "pointer",
        transition: `all ${transition.base}`,
      }}
    >
      {label}
    </button>
  );
}

function SkillCard({
  skill, index, expanded, onToggle, skills,
}: {
  skill: AgentSkill;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  skills: AgentSkill[];
}): ReactElement {
  const tint = CATEGORY_TINT[skill.category];
  const byId = useMemo(() => new Map(skills.map(s => [s.id, s])), [skills]);

  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        ...skillCardStyle,
        borderColor: expanded ? tint : color.border,
        boxShadow: expanded ? `0 0 0 2px ${tint}28` : "none",
        animationDelay: `${Math.min(index, 30) * STAGGER_MS}ms`,
      }}
    >
      <div style={cardHeaderStyle}>
        <span style={{ fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.text0 }}>
          {skill.name}
        </span>
        <span style={{
          padding: `${space[0]}px ${space[2]}px`,
          borderRadius: radius.pill,
          background: `${tint}18`,
          color: tint,
          fontSize: font.size.xxs,
          fontWeight: font.weight.semibold,
          fontFamily: font.mono,
        }}>
          {CATEGORY_LABEL[skill.category]}
        </span>
      </div>

      <div style={{ fontSize: font.size.xs, color: color.text1, lineHeight: 1.5, marginTop: space[1] }}>
        {skill.description}
      </div>

      <div style={ioRowStyle}>
        <span style={ioBlockStyle}>
          {skill.inputs.map(i => (
            <span key={i} style={ioChipStyle}>{i}</span>
          ))}
        </span>
        <span style={{ color: color.text3, fontSize: font.size.md, fontFamily: font.mono, margin: `0 ${space[2]}px` }}>→</span>
        <span style={ioBlockStyle}>
          {skill.outputs.map(o => (
            <span key={o} style={{ ...ioChipStyle, color: tint, borderColor: `${tint}55` }}>{o}</span>
          ))}
        </span>
      </div>

      <div style={statsRowStyle}>
        <span style={statStyle}>
          <span style={statLabelStyle}>avg cost</span>
          <span style={{ ...statValueStyle, color: color.text0 }}>{fmtUsd(skill.avgCostUsd)}</span>
        </span>
        <span style={statStyle}>
          <span style={statLabelStyle}>success</span>
          <span style={{ display: "flex", alignItems: "center", gap: space[1] }}>
            <span style={barWrapStyle}>
              <span style={{
                ...barFillStyle,
                width: `${skill.successRate * 100}%`,
                background: tint,
                animationDelay: `${Math.min(index, 30) * STAGGER_MS + 120}ms`,
              }} />
            </span>
            <span style={{ ...statValueStyle, color: tint, minWidth: 34, textAlign: "right" }}>
              {Math.round(skill.successRate * 100)}%
            </span>
          </span>
        </span>
        <span style={statStyle}>
          <span style={statLabelStyle}>used</span>
          <span style={{ ...statValueStyle, color: color.text0 }}>{skill.usageCount}x</span>
        </span>
      </div>

      {expanded && (
        <div style={composableWithStyle}>
          <span style={{
            fontSize: font.size.xxs,
            color: color.text2,
            letterSpacing: font.letter.ultra,
            textTransform: "uppercase",
            fontWeight: font.weight.semibold,
            marginRight: space[2],
          }}>
            composable with
          </span>
          {skill.composableWith.length === 0 ? (
            <span style={{ fontSize: font.size.xxs, color: color.text3, fontStyle: "italic" }}>
              (없음 — standalone skill)
            </span>
          ) : skill.composableWith.map(id => {
            const s = byId.get(id);
            if (!s) return null;
            const t = CATEGORY_TINT[s.category];
            return (
              <span
                key={id}
                style={{
                  padding: `${space[0]}px ${space[2]}px`,
                  borderRadius: radius.pill,
                  background: `${t}18`,
                  color: t,
                  fontSize: font.size.xxs,
                  fontFamily: font.mono,
                  fontWeight: font.weight.medium,
                }}
              >
                {s.name}
              </span>
            );
          })}
        </div>
      )}
    </button>
  );
}

function WorkflowSlot({ index, placeholder }: { index: number; placeholder: string }): ReactElement {
  return (
    <div
      style={{
        ...workflowSlotStyle,
        animationDelay: `${index * STAGGER_MS + 200}ms`,
      }}
    >
      <span style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
        {placeholder}
      </span>
    </div>
  );
}

function WorkflowArrow(): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: color.text3, fontSize: font.size.md, fontFamily: font.mono }}>
      ↓
    </div>
  );
}

function SkillGraph({
  skills, degree,
}: { skills: AgentSkill[]; degree: Record<string, number> }): ReactElement {
  const W = 900;
  const H = 340;
  const cx = W / 2;
  const cy = H / 2;

  // Layout: radial, larger nodes closer to center by degree.
  const maxDeg = Math.max(1, ...Object.values(degree));
  const positions = useMemo(() => {
    const n = skills.length;
    const pos = new Map<string, { x: number; y: number; r: number; tint: string }>();
    skills.forEach((s, i) => {
      const theta = (i / n) * Math.PI * 2 - Math.PI / 2;
      const degRatio = (degree[s.id] ?? 0) / maxDeg;
      // Hubs pulled toward center (inner ring); leaves on outer ring.
      const ringR = 130 - degRatio * 60;
      const x = cx + Math.cos(theta) * ringR;
      const y = cy + Math.sin(theta) * ringR * 0.72;
      const nodeR = 12 + degRatio * 12;
      pos.set(s.id, { x, y, r: nodeR, tint: CATEGORY_TINT[s.category] });
    });
    return pos;
  }, [skills, degree, maxDeg]);

  const edges = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ a: string; b: string }> = [];
    for (const s of skills) {
      for (const other of s.composableWith) {
        const k = [s.id, other].sort().join("|");
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ a: s.id, b: other });
      }
    }
    return out;
  }, [skills]);

  return (
    <div style={graphWrapStyle}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* Edges */}
        {edges.map((e, i) => {
          const a = positions.get(e.a);
          const b = positions.get(e.b);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={color.borderStrong}
              strokeWidth={1.2}
              strokeDasharray={200}
              strokeDashoffset={200}
              style={{
                animation: `sl-edge ${EDGE_MS}ms ${ENTRY_EASE} both`,
                animationDelay: `${i * 40 + 180}ms`,
              }}
              opacity={0.55}
            />
          );
        })}
        {/* Nodes */}
        {skills.map((s, i) => {
          const p = positions.get(s.id);
          if (!p) return null;
          const isHub = (degree[s.id] ?? 0) >= Math.max(3, maxDeg - 1);
          return (
            <g
              key={s.id}
              style={{
                animation: `sl-node 520ms ${ENTRY_EASE} both`,
                animationDelay: `${i * 40 + 120}ms`,
                transformOrigin: `${p.x}px ${p.y}px`,
              }}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={`${p.tint}28`}
                stroke={p.tint}
                strokeWidth={isHub ? 2 : 1.2}
              />
              <text
                x={p.x}
                y={p.y + p.r + 12}
                fontFamily={font.mono}
                fontSize={10}
                fill={isHub ? color.text0 : color.text2}
                textAnchor="middle"
                fontWeight={isHub ? 600 : 400}
              >
                {s.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        padding: `${space[2]}px ${space[3]}px`,
        borderTop: `1px solid ${color.borderSoft}`,
        fontSize: font.size.xxs,
        color: color.text3,
        fontFamily: font.mono,
      }}>
        <span>총 {edges.length} composability 엣지</span>
        <span>Hub: 가장 연결된 skill — 워크플로우 중앙 배치 권장</span>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `sl-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
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
  fontSize: font.size.xxl,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  marginTop: 2,
};

const filterRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  flexWrap: "wrap",
  marginBottom: space[4],
};

const mainGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 3fr) minmax(220px, 1fr)",
  gap: space[4],
  alignItems: "start",
  marginBottom: space[5],
};

const cardsColStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const sectionHeadStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  marginBottom: space[2],
};

const sectionHeadRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: space[2],
};

const cardListStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
  gap: space[3],
};

const skillCardStyle: CSSProperties = {
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  cursor: "pointer",
  font: "inherit",
  transition: `all ${transition.base}`,
  animation: `sl-tile 460ms ${ENTRY_EASE} both`,
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: space[2],
};

const ioRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: space[1],
  marginTop: space[1],
};

const ioBlockStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: space[1],
};

const ioChipStyle: CSSProperties = {
  padding: `${space[0]}px ${space[2]}px`,
  borderRadius: radius.sm,
  border: `1px solid ${color.border}`,
  background: color.bg2,
  color: color.text2,
  fontFamily: font.mono,
  fontSize: font.size.xxs,
};

const statsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.5fr 1fr",
  gap: space[3],
  marginTop: space[2],
  paddingTop: space[2],
  borderTop: `1px solid ${color.borderSoft}`,
};

const statStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
};

const statLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
};

const statValueStyle: CSSProperties = {
  fontSize: font.size.sm,
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
  fontVariantNumeric: "tabular-nums",
};

const barWrapStyle: CSSProperties = {
  flex: 1,
  height: 4,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
  position: "relative",
};

const barFillStyle: CSSProperties = {
  height: "100%",
  transformOrigin: "left center",
  animation: `sl-bar ${BAR_MS}ms ${ENTRY_EASE} both`,
};

const composableWithStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: space[1],
  marginTop: space[2],
  paddingTop: space[2],
  borderTop: `1px solid ${color.borderSoft}`,
};

const workflowColStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  position: "sticky",
  top: 0,
};

const workflowStubStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[1],
  padding: space[3],
  background: color.bg2,
  border: `1px dashed ${color.border}`,
  borderRadius: radius.md,
};

const workflowSlotStyle: CSSProperties = {
  height: 52,
  background: color.bg1,
  border: `1px dashed ${color.borderStrong}`,
  borderRadius: radius.md,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  animation: `sl-tile 460ms ${ENTRY_EASE} both`,
};

const graphSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const graphWrapStyle: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

export const SkillLibraryView = memo(SkillLibraryViewImpl);
