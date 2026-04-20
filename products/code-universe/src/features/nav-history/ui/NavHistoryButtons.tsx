import type { CSSProperties, ReactElement } from "react";
import { DEFAULT_TIER_LADDER, tierStore } from "../../../entities/tier";
import { entityStore } from "../../../entities/entity";
import { color, radius, transition } from "../../../shared/ui/tokens";
import { IconChevronLeft, IconChevronRight } from "../../../shared/ui/icons";
import { navHistoryStore, useNavHistory } from "../model/store";

// NavHistoryButtons — Back / Forward paired with the sidebar toggle
// to the left of the product title. Same icon-button chrome as the
// sidebar toggle in CanvasShell so the leading cluster reads as one
// nav control group.

const BUTTON: CSSProperties = {
  width: 28,
  height: 28,
  border: "1px solid transparent",
  background: "transparent",
  color: color.text1,
  borderRadius: radius.md,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: `background ${transition.fast}, color ${transition.fast}`,
};

const BUTTON_DISABLED: CSSProperties = {
  ...BUTTON,
  color: color.text3,
  cursor: "default",
};

export function NavHistoryButtons(): ReactElement {
  const cursor = useNavHistory(s => s.cursor);
  const length = useNavHistory(s => s.entries.length);
  const canBack = cursor > 0;
  const canForward = cursor >= 0 && cursor < length - 1;

  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      <button
        type="button"
        style={canBack ? BUTTON : BUTTON_DISABLED}
        disabled={!canBack}
        onClick={() => {
          const entry = navHistoryStore.back();
          if (!entry) return;
          const spec = DEFAULT_TIER_LADDER.find(t => t.name === entry.tier);
          entityStore.selectEntity(entry.selectedId);
          if (spec) tierStore.jumpToTier(spec.name);
        }}
        aria-label="Navigate back (Alt+←)"
        title="Back — Alt+←"
        onMouseEnter={e => {
          if (canBack) e.currentTarget.style.background = color.hover;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <IconChevronLeft size={16} />
      </button>
      <button
        type="button"
        style={canForward ? BUTTON : BUTTON_DISABLED}
        disabled={!canForward}
        onClick={() => {
          const entry = navHistoryStore.forward();
          if (!entry) return;
          const spec = DEFAULT_TIER_LADDER.find(t => t.name === entry.tier);
          entityStore.selectEntity(entry.selectedId);
          if (spec) tierStore.jumpToTier(spec.name);
        }}
        aria-label="Navigate forward (Alt+→)"
        title="Forward — Alt+→"
        onMouseEnter={e => {
          if (canForward) e.currentTarget.style.background = color.hover;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <IconChevronRight size={16} />
      </button>
    </span>
  );
}
