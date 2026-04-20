import { useState, type CSSProperties, type ReactElement } from "react";
import { useEntityState } from "../../../entities/entity";
import { EntityTreeItem } from "./EntityTreeItem";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  IconExplorer,
  IconLens,
  IconPin,
  IconSearch,
} from "../../../shared/ui/icons";

// LeftPanel — activity rail + content region. Rail icons are real SVG
// (not unicode glyphs) so they hold up at any system font size and
// inherit currentColor for hover/active states. Content section header
// reads as a soft label, not the old uppercase shouting.

type TabId = "explorer" | "search" | "pins" | "lens";

interface TabSpec {
  id: TabId;
  label: string;
  Icon: (p: { size?: number }) => ReactElement;
}

const TABS: readonly TabSpec[] = [
  { id: "explorer", label: "Explorer", Icon: IconExplorer },
  { id: "search", label: "Search", Icon: IconSearch },
  { id: "pins", label: "Pins", Icon: IconPin },
  { id: "lens", label: "Lens", Icon: IconLens },
];

const RAIL_W = 44;

const RAIL_STYLE: CSSProperties = {
  width: RAIL_W,
  flexShrink: 0,
  borderRight: `1px solid ${color.border}`,
  background: color.bg2,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingTop: space[2],
  gap: 2,
};

const CONTENT_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  overflow: "hidden",
};

export function LeftPanel(): ReactElement {
  const [active, setActive] = useState<TabId>("explorer");
  const tree = useEntityState(s => s.tree);
  const activeTab = TABS.find(t => t.id === active);

  return (
    <div style={{ display: "flex", height: "100%", background: color.bg1 }}>
      <div style={RAIL_STYLE} role="tablist" aria-orientation="vertical">
        {TABS.map(tab => {
          const isActive = tab.id === active;
          const { Icon } = tab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              title={tab.label}
              onClick={() => setActive(tab.id)}
              style={{
                width: 32,
                height: 32,
                border: "none",
                borderRadius: radius.md,
                background: isActive ? color.accentSoft : "transparent",
                color: isActive ? color.accent : color.text1,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transition: `background ${transition.fast}, color ${transition.fast}`,
                position: "relative",
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = color.hover;
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              {isActive ? (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: -8,
                    top: 7,
                    bottom: 7,
                    width: 2,
                    borderRadius: radius.pill,
                    background: color.accent,
                  }}
                />
              ) : null}
              <Icon size={16} />
            </button>
          );
        })}
      </div>

      <div style={CONTENT_STYLE}>
        <header
          style={{
            padding: `${space[3]}px ${space[4]}px ${space[2]}px`,
            fontSize: font.size.xs,
            fontWeight: font.weight.semibold,
            letterSpacing: font.letter.ultra,
            textTransform: "uppercase",
            color: color.text2,
          }}
        >
          {activeTab?.label}
        </header>

        <div style={{ flex: 1, overflow: "auto" }}>
          {active === "explorer" ? (
            tree ? (
              <div role="tree" style={{ padding: `${space[1]}px 0 ${space[3]}px` }}>
                <EntityTreeItem entity={tree.byId.get(tree.rootId)!} tree={tree} depth={0} />
              </div>
            ) : (
              <EmptyState text="No universe loaded." />
            )
          ) : (
            <EmptyState text="Coming soon." />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }): ReactElement {
  return (
    <div
      style={{
        padding: `${space[6]}px ${space[4]}px`,
        fontSize: font.size.sm,
        color: color.text2,
        textAlign: "center",
        fontStyle: "italic",
      }}
    >
      {text}
    </div>
  );
}
