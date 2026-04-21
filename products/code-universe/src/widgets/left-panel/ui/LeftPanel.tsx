import { useEffect, type CSSProperties, type ReactElement } from "react";
import { useEntityState } from "../../../entities/entity";
import { EntityTreeItem } from "./EntityTreeItem";
import { expansionStore } from "../model/expansion-store";
import { color, font, space } from "../../../shared/ui/tokens";

// LeftPanel — single-purpose Explorer. The activity rail (Search /
// Pins / Lens) was removed because only Explorer was ever wired up;
// the rest were dead icons taking horizontal space.

const CONTENT_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  overflow: "hidden",
  height: "100%",
};

export function LeftPanel(): ReactElement {
  const tree = useEntityState(s => s.tree);
  const anchorId = useEntityState(s => s.interaction.anchorId);
  const selectedId = useEntityState(s => s.interaction.selectedId);

  // Sync with canvas: whenever the user drills on the canvas (anchor
  // commit) or selects a file/floor/room, walk the ancestor chain
  // (INCLUDING the focus itself so folder-kind anchors open to show
  // their children) and reveal every row on the path. Re-runs per
  // commit, so a later user-driven collapse sticks until the next
  // drill. When nothing is focused we still open the root so the
  // tree isn't a single collapsed line.
  useEffect(() => {
    if (!tree) return;
    const focusId = anchorId ?? selectedId;
    const chain: string[] = [tree.rootId];
    if (focusId && tree.byId.has(focusId)) {
      chain.push(focusId);
      for (const a of tree.ancestorsOf(focusId)) {
        if (a.id !== focusId) chain.push(a.id);
      }
    }
    expansionStore.revealChain(chain);
  }, [tree, anchorId, selectedId]);

  // Tree swap (graph reload, tab remount) — forget manual expansions
  // so the next drill starts from a clean slate. Runs AFTER the sync
  // effect above so the anchor's chain reveals fresh.
  useEffect(() => {
    return () => {
      expansionStore.reset();
    };
  }, [tree]);

  return (
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
        Explorer
      </header>

      <div style={{ flex: 1, overflow: "auto" }}>
        {tree ? (
          <div role="tree" style={{ padding: `${space[1]}px 0 ${space[3]}px` }}>
            <EntityTreeItem entity={tree.byId.get(tree.rootId)!} tree={tree} depth={0} />
          </div>
        ) : (
          <EmptyState text="No universe loaded." />
        )}
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
