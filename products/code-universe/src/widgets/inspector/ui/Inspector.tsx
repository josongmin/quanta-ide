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
    if (spec) tierStore.jumpToTier(spec.name);
  }, [children]);
  const onToggleFocus = useCallback(() => {
    entityStore.setFocusMode(focusMode === "neighborhood" ? "none" : "neighborhood");
  }, [focusMode]);

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
        <Relations tree={tree} inbound={relations.inbound} outbound={relations.outbound} />
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

function Relations({
  tree,
  inbound,
  outbound,
}: {
  tree: EntityTree;
  inbound: readonly TierEdge[];
  outbound: readonly TierEdge[];
}): ReactElement | null {
  if (inbound.length === 0 && outbound.length === 0) return null;
  const MAX = 8;
  return (
    <Section title="Relations">
      <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
        {inbound.length > 0 ? (
          <RelationGroup
            icon={<IconArrowIn size={11} />}
            label="Inbound"
            edges={inbound.slice(0, MAX)}
            total={inbound.length}
            tree={tree}
            counterpart="fromId"
          />
        ) : null}
        {outbound.length > 0 ? (
          <RelationGroup
            icon={<IconArrowOut size={11} />}
            label="Outbound"
            edges={outbound.slice(0, MAX)}
            total={outbound.length}
            tree={tree}
            counterpart="toId"
          />
        ) : null}
      </div>
    </Section>
  );
}

function RelationGroup({
  icon,
  label,
  edges,
  total,
  tree,
  counterpart,
}: {
  icon: ReactNode;
  label: string;
  edges: readonly TierEdge[];
  total: number;
  tree: EntityTree;
  counterpart: "fromId" | "toId";
}): ReactElement {
  const maxWeight = edges.reduce((m, e) => Math.max(m, e.weight), 0) || 1;
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: space[1],
          fontSize: font.size.xs,
          color: color.text1,
          fontWeight: font.weight.medium,
        }}
      >
        <span style={{ color: color.text2 }}>{icon}</span>
        <span>{label}</span>
        <span style={{ color: color.text3, fontVariantNumeric: "tabular-nums" }}>
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
              <span style={{ width: 6, height: 6, borderRadius: radius.pill, background: kindColor[other.kind], flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: font.size.md, color: color.text0, letterSpacing: font.letter.tight }}>
                {other.name}
              </span>
              <span style={{ fontSize: font.size.xs, color: color.text2, fontVariantNumeric: "tabular-nums", fontWeight: font.weight.medium }}>
                {edge.count}
              </span>
              <span style={{ width: 40, height: 3, borderRadius: radius.pill, background: color.bg2, overflow: "hidden", flexShrink: 0 }}>
                <span style={{ display: "block", height: "100%", width: `${barW}%`, background: color.accent, opacity: 0.75 }} />
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
