import { cn } from "@quanta/ui-kit/lib";
import { HighlightedLabel } from "./HighlightedLabel";
import { CategoryIcon } from "./icons";
import type { CommandEntry } from "./command-palette.types";

interface CommandRowProps {
  entry: CommandEntry;
  flatIndex: number;
  isSelected: boolean;
  onHover: (index: number) => void;
  onRun: (index: number) => void;
}

export function CommandRow({ entry, flatIndex, isSelected, onHover, onRun }: CommandRowProps) {
  return (
    <div
      data-palette-index={flatIndex}
      className={cn("cp__row", isSelected && "cp__row--selected")}
      onMouseEnter={() => onHover(flatIndex)}
      onMouseDown={(ev) => {
        ev.preventDefault();
        onRun(flatIndex);
      }}
      role="option"
      aria-selected={isSelected}
    >
      <span className="cp__row-icon" aria-hidden>
        <CategoryIcon category={entry.feature.category} />
      </span>
      <span className="cp__row-main">
        <span className="cp__row-title">
          <HighlightedLabel text={entry.command.title} positions={entry.titlePositions} />
        </span>
        <span className="cp__row-feature">
          <HighlightedLabel text={entry.feature.title} positions={entry.featurePositions} />
        </span>
      </span>
      {entry.command.keybinding ? (
        <span className="cp__row-kb">{entry.command.keybinding}</span>
      ) : null}
      <span className="cp__row-chev" aria-hidden>
        ↵
      </span>
    </div>
  );
}
