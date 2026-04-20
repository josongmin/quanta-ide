import { useCallback, useMemo, type CSSProperties, type ReactElement, type ReactNode } from "react";
import type { Entity, EntityTree, TierEdge } from "@quanta/canvas-engine";
import { entityStore, useEntityState } from "../../../entities/entity";
import { DEFAULT_TIER_LADDER, tierStore } from "../../../entities/tier";
import { useWorkspaceGraph } from "../../../shared/api/graph-source";
import { computeEntityRelations } from "../../../shared/lib/entity-edges";
import {
  color,
  font,
  kindColor,
  kindLabel,
  radius,
  shadow,
  space,
  transition,
} from "../../../shared/ui/tokens";
import {
  IconArrowIn,
  IconArrowOut,
  IconArrowRight,
  IconClose,
  IconTarget,
} from "../../../shared/ui/icons";

// Inspector — right panel. Summary / Metrics / Relations / Children /
// Actions stacked as cards on a slightly-inset surface. Buttons and
// badges use the shared token set so the panel reads like the same
// product as the LeftPanel and canvas-header chrome.

export function Inspector(): ReactElement {
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const tree = useEntityState(s => s.tree);

  if (!selectedId || !tree) return <EmptyInspector />;
  const entity = tree.byId.get(selectedId);
  if (!entity) return <EmptyInspector />;

  return <LoadedInspector entity={entity} tree={tree} />;
}

function LoadedInspector({ entity, tree }: { entity: Entity; tree: EntityTree }): ReactElement {
  const ancestors = [...tree.ancestorsOf(entity.id)].reverse();
  const children = tree.childrenOf(entity.id);
  const graph = useWorkspaceGraph();
  const focusMode = useEntityState(s => s.interaction.focusMode);

  const relations = useMemo(() => {
    if (!graph) return { inbound: [], outbound: [] as readonly TierEdge[] };
    return computeEntityRelations(tree, graph.fileEdges, entity.id, entity.kind);
  }, [tree, graph, entity.id, entity.kind]);

  const onClear = useCallback(() => entityStore.selectEntity(null), []);
  const onDrillIn = useCallback(() => {
    if (children.length === 0) return;
    const counts = new Map<Entity["kind"], number>();
    for (const c of children) counts.set(c.kind, (counts.get(c.kind) ?? 0) + 1);
    let topKind: Entity["kind"] = children[0]!.kind;
    let topN = 0;
    for (const [k, n] of counts) if (n > topN) { topKind = k; topN = n; }
    const spec = DEFAULT_TIER_LADDER.find(t => t.visibleKind === topKind);
    if (!spec) return;
    // Commit THIS entity as the new scope anchor — the subtree filter
    // then narrows the drilled-into tier to this entity's descendants
    // only. Matches the spec's "줌 레벨 변경 = 관심 범위 유지" rule.
    entityStore.setAnchor(entity.id);
    tierStore.jumpToTier(spec.name);
  }, [children, entity.id]);
  const onToggleFocus = useCallback(() => {
    // "Exit focus" drops to overview — clears anchor too so the next
    // click can freshly decide the new scope. "Focus" (turning it on
    // from overview) anchors on the current selection so the canvas
    // narrows to whatever the user was just inspecting.
    if (focusMode === "neighborhood") {
      entityStore.setAnchor(null);
    } else {
      entityStore.setAnchor(entity.id);
    }
  }, [focusMode, entity.id]);

  const hasRelations = relations.inbound.length + relations.outbound.length > 0;
  const dot = kindColor[entity.kind];

  return (
    <div style={PANEL_STYLE}>
      <div style={SCROLL_STYLE}>
        <Crumbs ancestors={ancestors} />

        <div style={{ padding: `${space[3]}px ${space[4]}px ${space[4]}px` }}>
          <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
            <KindBadge entityKind={entity.kind} />
            {children.length > 0 ? (
              <span style={META_PILL}>
                {children.length} {children.length === 1 ? "child" : "children"}
              </span>
            ) : null}
            {focusMode === "neighborhood" ? (
              <span style={FOCUS_PILL}>
                <IconTarget size={10} /> focused
              </span>
            ) : null}
          </div>
          <h2 style={TITLE_STYLE}>{entity.name}</h2>
          {entity.path ? (
            <div style={PATH_STYLE}>
              <span style={{ color: dot }}>●</span>
              {entity.path}
            </div>
          ) : null}
        </div>

        <Metrics entity={entity} />
        <Dependencies tree={tree} inbound={relations.inbound} outbound={relations.outbound} />
        <ChildrenList entity={entity} tree={tree} />
      </div>

      <footer style={FOOTER_STYLE}>
        {hasRelations ? (
          <button
            type="button"
            style={focusMode === "neighborhood" ? buttonPrimary() : buttonSecondary()}
            onClick={onToggleFocus}
            title="Isolate this entity and its 1-hop neighbors on the canvas"
          >
            <IconTarget size={12} />
            {focusMode === "neighborhood" ? "Exit focus" : "Focus"}
          </button>
        ) : null}
        {children.length > 0 ? (
          <button type="button" style={buttonPrimary()} onClick={onDrillIn}>
            <IconArrowRight size={12} />
            Drill in
          </button>
        ) : null}
        <button type="button" style={buttonGhost()} onClick={onClear} title="Clear selection (Esc)">
          <IconClose size={12} />
        </button>
      </footer>
    </div>
  );
}

function KindBadge({ entityKind }: { entityKind: Entity["kind"] }): ReactElement {
  const c = kindColor[entityKind];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: font.size.xxs,
        fontWeight: font.weight.semibold,
        letterSpacing: font.letter.ultra,
        textTransform: "uppercase",
        color: c,
        padding: "3px 8px",
        borderRadius: radius.pill,
        background: tintBg(c, 0.1),
        border: `1px solid ${tintBg(c, 0.2)}`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: radius.pill, background: c }} />
      {kindLabel[entityKind]}
    </span>
  );
}

function Crumbs({ ancestors }: { ancestors: Entity[] }): ReactElement | null {
  if (ancestors.length <= 1) return null;
  const chain = ancestors.slice(0, -1);
  return (
    <div
      style={{
        padding: `${space[2]}px ${space[4]}px`,
        fontSize: font.size.sm,
        color: color.text2,
        fontFamily: font.mono,
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexWrap: "wrap",
      }}
    >
      {chain.map((a, i) => (
        <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <button
            type="button"
            onClick={() => entityStore.selectEntity(a.id)}
            style={crumbLink()}
          >
            {a.name}
          </button>
          {i < chain.length - 1 ? <span style={{ opacity: 0.5 }}>/</span> : null}
        </span>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section style={{ padding: `${space[3]}px ${space[4]}px`, borderTop: `1px solid ${color.border}` }}>
      <div
        style={{
          fontSize: font.size.xxs,
          fontWeight: font.weight.semibold,
          letterSpacing: font.letter.ultra,
          textTransform: "uppercase",
          color: color.text2,
          marginBottom: space[2],
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function Metrics({ entity }: { entity: Entity }): ReactElement | null {
  const m = entity.metrics;
  if (!m) return null;
  const rows: { label: string; value: string }[] = [];
  if (m.loc !== undefined) rows.push({ label: "Lines", value: m.loc.toLocaleString() });
  if (m.riskScore !== undefined) rows.push({ label: "Risk", value: m.riskScore.toFixed(1) });
  if (m.fileCount !== undefined) rows.push({ label: "Files", value: m.fileCount.toLocaleString() });
  if (m.childCount !== undefined) rows.push({ label: "Children", value: m.childCount.toLocaleString() });
  if (rows.length === 0) return null;
  return (
    <Section title="Metrics">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[2] }}>
        {rows.map(r => (
          <div
            key={r.label}
            style={{
              padding: `${space[2]}px ${space[3]}px`,
              background: color.bg2,
              borderRadius: radius.md,
              border: `1px solid ${color.borderSoft}`,
            }}
          >
            <div style={{ fontSize: font.size.xxs, color: color.text2, fontWeight: font.weight.medium, letterSpacing: font.letter.ultra, textTransform: "uppercase" }}>
              {r.label}
            </div>
            <div style={{ fontSize: font.size.xl, fontWeight: font.weight.semibold, color: color.text0, fontVariantNumeric: "tabular-nums", letterSpacing: font.letter.tight, marginTop: 2 }}>
              {r.value}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// Dependencies
// --------------------------------------------------------------------
// Shows every 1-hop dependency of the selected entity. Three layers:
//   1. Summary tiles — Inbound / Outbound counts with ref totals.
//   2. Radial mini-map — center dot = the selection, left hemisphere
//      = inbound, right = outbound, spokes coloured by direction so
//      the dep structure is visible at a glance before the lists.
//   3. Grouped lists — inbound (green) + outbound (blue) rows with
//      gradient weight bars. Hover propagates to the canvas hover
//      store so the corresponding rect pulses on the viewport. Click
//      jumps the selection there.
//
// The colour palette here (success-green for inbound, accent-blue for
// outbound) mirrors the pixi `edgeIn` / `edgeOut` tokens so the
// mental model is one-to-one between panel and canvas.
const DEP_LIST_MAX = 8;
const DEP_RADIAL_MAX_POINTS = 24;

function Dependencies({
  tree,
  inbound,
  outbound,
}: {
  tree: EntityTree;
  inbound: readonly TierEdge[];
  outbound: readonly TierEdge[];
}): ReactElement | null {
  if (inbound.length === 0 && outbound.length === 0) return null;
  const inRefs = inbound.reduce((n, e) => n + e.count, 0);
  const outRefs = outbound.reduce((n, e) => n + e.count, 0);
  const total = inbound.length + outbound.length;
  return (
    <Section title={`Dependencies · ${total}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[2] }}>
          <DepStat direction="in" count={inbound.length} refs={inRefs} />
          <DepStat direction="out" count={outbound.length} refs={outRefs} />
        </div>
        {total > 0 && total <= 96 ? (
          <DepRadial inbound={inbound} outbound={outbound} tree={tree} />
        ) : null}
        {inbound.length > 0 ? (
          <DepGroup
            direction="in"
            edges={inbound.slice(0, DEP_LIST_MAX)}
            total={inbound.length}
            tree={tree}
          />
        ) : null}
        {outbound.length > 0 ? (
          <DepGroup
            direction="out"
            edges={outbound.slice(0, DEP_LIST_MAX)}
            total={outbound.length}
            tree={tree}
          />
        ) : null}
      </div>
    </Section>
  );
}

function DepStat({
  direction,
  count,
  refs,
}: {
  direction: "in" | "out";
  count: number;
  refs: number;
}): ReactElement {
  const dirColor = direction === "in" ? color.success : color.accent;
  const Icon = direction === "in" ? IconArrowIn : IconArrowOut;
  const label = direction === "in" ? "Inbound" : "Outbound";
  return (
    <div
      style={{
        position: "relative",
        padding: `${space[3]}px ${space[3]}px ${space[2]}px`,
        borderRadius: radius.md,
        background: color.bg2,
        border: `1px solid ${color.borderSoft}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "0 0 auto 0",
          height: 2,
          background: dirColor,
        }}
      />
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: dirColor,
          fontSize: font.size.xxs,
          fontWeight: font.weight.semibold,
          letterSpacing: font.letter.ultra,
          textTransform: "uppercase",
        }}
      >
        <Icon size={10} />
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: font.size.display,
          fontWeight: font.weight.semibold,
          color: color.text0,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: font.letter.tight,
          lineHeight: 1,
        }}
      >
        {count}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: font.size.xs,
          color: color.text2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {refs} {refs === 1 ? "ref" : "refs"}
      </div>
    </div>
  );
}

function DepRadial({
  inbound,
  outbound,
  tree,
}: {
  inbound: readonly TierEdge[];
  outbound: readonly TierEdge[];
  tree: EntityTree;
}): ReactElement {
  const W = 280;
  const H = 148;
  const cx = W / 2;
  const cy = H / 2;
  // Inbound on the LEFT hemisphere (flows into the center), outbound
  // on the RIGHT (flows out). Separate radii so labels don't collide
  // when both sides are crowded.
  const rIn = 54;
  const rOut = 60;
  const maxIn = Math.min(inbound.length, DEP_RADIAL_MAX_POINTS);
  const maxOut = Math.min(outbound.length, DEP_RADIAL_MAX_POINTS);
  const inPts = inbound.slice(0, DEP_RADIAL_MAX_POINTS).map((edge, i) => {
    // Spread 110°→250° clockwise (left half of the circle).
    const t = maxIn === 1 ? 0.5 : i / (maxIn - 1);
    const theta = Math.PI * ((110 + t * 140) / 180);
    return {
      edge,
      x: cx + rIn * Math.cos(theta),
      y: cy + rIn * Math.sin(theta),
      other: tree.byId.get(edge.fromId),
    };
  });
  const outPts = outbound.slice(0, DEP_RADIAL_MAX_POINTS).map((edge, i) => {
    // Spread 290°→70° (right half) — equivalent to -70° → +70°.
    const t = maxOut === 1 ? 0.5 : i / (maxOut - 1);
    const theta = Math.PI * ((-70 + t * 140) / 180);
    return {
      edge,
      x: cx + rOut * Math.cos(theta),
      y: cy + rOut * Math.sin(theta),
      other: tree.byId.get(edge.toId),
    };
  });
  return (
    <div
      style={{
        padding: space[2],
        borderRadius: radius.md,
        background: color.bg2,
        border: `1px solid ${color.borderSoft}`,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <svg width={W} height={H} style={{ display: "block" }} role="img" aria-label="Dependency radial map">
        <defs>
          <radialGradient id="depCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color.accent} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color.accent} stopOpacity="0.35" />
          </radialGradient>
        </defs>
        {/* Soft ring behind the core to anchor the composition. */}
        <circle cx={cx} cy={cy} r={24} fill="none" stroke={color.border} strokeDasharray="2 3" strokeOpacity="0.6" />
        {inPts.map((p, i) => (
          <line
            key={`il${i}`}
            x1={p.x}
            y1={p.y}
            x2={cx}
            y2={cy}
            stroke={color.success}
            strokeOpacity={0.55}
            strokeWidth={1}
            strokeLinecap="round"
          />
        ))}
        {outPts.map((p, i) => (
          <line
            key={`ol${i}`}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke={color.accent}
            strokeOpacity={0.55}
            strokeWidth={1}
            strokeLinecap="round"
          />
        ))}
        {inPts.map((p, i) => {
          const hue = p.other ? kindColor[p.other.kind] : color.success;
          return (
            <g key={`in${i}`}>
              <circle cx={p.x} cy={p.y} r={5} fill={color.bg1} />
              <circle cx={p.x} cy={p.y} r={3.25} fill={hue} />
            </g>
          );
        })}
        {outPts.map((p, i) => {
          const hue = p.other ? kindColor[p.other.kind] : color.accent;
          return (
            <g key={`on${i}`}>
              <circle cx={p.x} cy={p.y} r={5} fill={color.bg1} />
              <circle cx={p.x} cy={p.y} r={3.25} fill={hue} />
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={11} fill="url(#depCore)" />
        <circle cx={cx} cy={cy} r={5.5} fill={color.accent} />
        <circle cx={cx} cy={cy} r={2} fill={color.bg1} />
      </svg>
    </div>
  );
}

function DepGroup({
  direction,
  edges,
  total,
  tree,
}: {
  direction: "in" | "out";
  edges: readonly TierEdge[];
  total: number;
  tree: EntityTree;
}): ReactElement {
  const maxWeight = edges.reduce((m, e) => Math.max(m, e.weight), 0) || 1;
  const counterpart: "fromId" | "toId" = direction === "in" ? "fromId" : "toId";
  const dirColor = direction === "in" ? color.success : color.accent;
  const Icon = direction === "in" ? IconArrowIn : IconArrowOut;
  const label = direction === "in" ? "Inbound" : "Outbound";
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: space[1],
          fontSize: font.size.xxs,
          color: dirColor,
          fontWeight: font.weight.semibold,
          letterSpacing: font.letter.ultra,
          textTransform: "uppercase",
        }}
      >
        <Icon size={11} />
        <span>{label}</span>
        <span
          style={{
            color: color.text3,
            fontVariantNumeric: "tabular-nums",
            marginLeft: "auto",
            textTransform: "none",
            letterSpacing: font.letter.tight,
            fontWeight: font.weight.medium,
          }}
        >
          {total > edges.length ? `${edges.length} of ${total}` : total}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {edges.map(edge => {
          const otherId = edge[counterpart];
          const other = tree.byId.get(otherId);
          if (!other) return null;
          const barW = Math.round((edge.weight / maxWeight) * 100);
          return (
            <button
              key={edge.id}
              type="button"
              onClick={() => entityStore.selectEntity(otherId)}
              onMouseEnter={e => {
                entityStore.hoverEntity(otherId);
                e.currentTarget.style.background = color.hover;
              }}
              onMouseLeave={e => {
                const cur = entityStore.getState().interaction.hoveredId;
                if (cur === otherId) entityStore.hoverEntity(null);
                e.currentTarget.style.background = "transparent";
              }}
              style={relationRow()}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: radius.pill,
                  background: kindColor[other.kind],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: font.size.md,
                  color: color.text0,
                  letterSpacing: font.letter.tight,
                }}
              >
                {other.name}
              </span>
              <span
                style={{
                  fontSize: font.size.xs,
                  color: color.text2,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: font.weight.medium,
                  minWidth: 18,
                  textAlign: "right",
                }}
              >
                {edge.count}
              </span>
              <span
                style={{
                  width: 52,
                  height: 4,
                  borderRadius: radius.pill,
                  background: color.bg2,
                  overflow: "hidden",
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${barW}%`,
                    background: `linear-gradient(90deg, ${dirColor}33, ${dirColor})`,
                    borderRadius: radius.pill,
                    transition: `width ${transition.base}`,
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChildrenList({ entity, tree }: { entity: Entity; tree: EntityTree }): ReactElement | null {
  const kids = tree.childrenOf(entity.id);
  if (kids.length === 0) return null;
  const MAX = 20;
  const shown = kids.slice(0, MAX);
  return (
    <Section title={`Children · ${kids.length}`}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {shown.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => entityStore.selectEntity(c.id)}
            onMouseEnter={e => { e.currentTarget.style.background = color.hover; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            style={relationRow()}
          >
            <span style={{ width: 6, height: 6, borderRadius: radius.pill, background: kindColor[c.kind], flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: font.size.md, color: color.text0, letterSpacing: font.letter.tight }}>
              {c.name}
            </span>
          </button>
        ))}
        {kids.length > MAX ? (
          <div style={{ fontSize: font.size.sm, color: color.text2, padding: `${space[1]}px ${space[2]}px` }}>
            + {kids.length - MAX} more in Explorer
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function EmptyInspector(): ReactElement {
  return (
    <div style={PANEL_STYLE}>
      <div
        style={{
          margin: "auto",
          padding: `${space[6]}px ${space[4]}px`,
          textAlign: "center",
          color: color.text2,
          fontSize: font.size.md,
          lineHeight: 1.5,
          maxWidth: 260,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            background: color.bg2,
            margin: `0 auto ${space[3]}px`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: color.text3,
          }}
        >
          <IconTarget size={20} />
        </div>
        Select an entity on the canvas or from the Explorer to see its details.
      </div>
    </div>
  );
}

function tintBg(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function crumbLink(): CSSProperties {
  return {
    background: "none",
    border: "none",
    padding: "2px 4px",
    color: color.text1,
    fontSize: font.size.sm,
    fontFamily: font.mono,
    cursor: "pointer",
    borderRadius: radius.sm,
    transition: `background ${transition.fast}, color ${transition.fast}`,
  };
}

function relationRow(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: space[2],
    padding: `5px ${space[2]}px`,
    background: "transparent",
    border: "none",
    borderRadius: radius.sm,
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    transition: `background ${transition.fast}`,
  };
}

function buttonPrimary(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: `6px ${space[3]}px`,
    background: color.accent,
    color: "white",
    border: `1px solid ${color.accent}`,
    borderRadius: radius.md,
    fontSize: font.size.md,
    fontFamily: font.family,
    fontWeight: font.weight.medium,
    letterSpacing: font.letter.tight,
    cursor: "pointer",
    transition: `background ${transition.fast}`,
    flex: 1,
    justifyContent: "center",
  };
}

function buttonSecondary(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: `6px ${space[3]}px`,
    background: color.bg1,
    color: color.text0,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    fontSize: font.size.md,
    fontFamily: font.family,
    fontWeight: font.weight.medium,
    letterSpacing: font.letter.tight,
    cursor: "pointer",
    transition: `background ${transition.fast}, border-color ${transition.fast}`,
    flex: 1,
    justifyContent: "center",
  };
}

function buttonGhost(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    background: "transparent",
    color: color.text2,
    border: `1px solid transparent`,
    borderRadius: radius.md,
    cursor: "pointer",
    transition: `background ${transition.fast}, color ${transition.fast}`,
    flexShrink: 0,
  };
}

const PANEL_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: color.bg1,
};

const SCROLL_STYLE: CSSProperties = {
  flex: 1,
  overflow: "auto",
};

const FOOTER_STYLE: CSSProperties = {
  display: "flex",
  gap: space[2],
  padding: space[3],
  borderTop: `1px solid ${color.border}`,
  background: color.bg1,
  flexShrink: 0,
};

const TITLE_STYLE: CSSProperties = {
  margin: `${space[2]}px 0 4px`,
  fontSize: font.size.xxl,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
  lineHeight: 1.25,
  overflowWrap: "anywhere",
  fontFamily: font.family,
};

const PATH_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: font.size.sm,
  color: color.text2,
  fontFamily: font.mono,
  overflowWrap: "anywhere",
};

const META_PILL: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  fontWeight: font.weight.medium,
  padding: "2px 7px",
  borderRadius: radius.pill,
  background: color.bg2,
};

const FOCUS_PILL: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  marginLeft: "auto",
  fontSize: font.size.xxs,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  padding: "3px 8px",
  borderRadius: radius.pill,
  background: color.accent,
  color: "white",
  boxShadow: shadow.sm,
};
