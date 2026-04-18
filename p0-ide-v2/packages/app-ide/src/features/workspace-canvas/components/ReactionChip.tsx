import { memo, useCallback, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  REACTION_PALETTE,
  groupReactions,
  reactionsStore,
  type Reaction,
  type ReactionTargetKind,
} from "../store/reactions-store";

interface Props {
  targetKind: ReactionTargetKind;
  targetId: string;
  reactions: readonly Reaction[];
  scale: number;
  author?: string;
}

// Renders the grouped chips for a target + a "+" affordance that opens a
// small quick-pick palette. The chip row is absolute-positioned by the parent
// (typically the file card corner) — this component only owns layout/state of
// its own internals.
function ReactionChipInner({ targetKind, targetId, reactions, scale, author = "you" }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const invScale = scale > 0 ? 1 / scale : 1;
  const grouped = groupReactions(reactions, author);

  const onPickerToggle = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setPickerOpen(p => !p);
  }, []);

  const onPickEmoji = useCallback((emoji: string) => {
    reactionsStore.react({ kind: targetKind, id: targetId }, emoji, author);
    setPickerOpen(false);
  }, [targetKind, targetId, author]);

  const onChipClick = useCallback((emoji: string) => {
    reactionsStore.react({ kind: targetKind, id: targetId }, emoji, author);
  }, [targetKind, targetId, author]);

  return (
    <div
      className="ws-reactions"
      style={{ "--reactions-inv-scale": invScale.toFixed(4) } as React.CSSProperties}
      onPointerDown={e => e.stopPropagation()}
    >
      {grouped.map(g => (
        <button
          key={g.emoji}
          type="button"
          className={`ws-reactions__chip${g.byYou ? " is-mine" : ""}`}
          title={g.authors.join(", ")}
          onClick={() => onChipClick(g.emoji)}
        >
          <span className="ws-reactions__emoji">{g.emoji}</span>
          {g.count > 1 && <span className="ws-reactions__count">{g.count}</span>}
        </button>
      ))}
      <button
        type="button"
        className={`ws-reactions__add${pickerOpen ? " is-open" : ""}`}
        onPointerDown={onPickerToggle}
        title="add reaction"
      >
        +
      </button>
      {pickerOpen && (
        <div className="ws-reactions__palette">
          {REACTION_PALETTE.map(emoji => (
            <button
              key={emoji}
              type="button"
              className="ws-reactions__palette-btn"
              onPointerDown={e => { e.stopPropagation(); onPickEmoji(emoji); }}
              title={`react with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const ReactionChip = memo(ReactionChipInner);
