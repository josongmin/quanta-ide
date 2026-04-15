import { CommandRow } from "./CommandRow";
import type { CommandEntry, GroupedEntries } from "./command-palette.types";

interface CommandGroupProps {
  group: GroupedEntries;
  selectedIndex: number;
  indexOf: Map<string, number>;
  onHover: (index: number) => void;
  onRun: (index: number) => void;
}

export function CommandGroup({
  group,
  selectedIndex,
  indexOf,
  onHover,
  onRun,
}: CommandGroupProps) {
  return (
    <>
      <div className="cp__group-head">
        <span className="cp__group-label">{group.label}</span>
        <span className="cp__group-count">{group.items.length}</span>
      </div>
      {group.items.map((entry: CommandEntry) => {
        const flatIndex = indexOf.get(`${entry.feature.id}:${entry.command.id}`) ?? 0;
        return (
          <CommandRow
            key={`${entry.feature.id}:${entry.command.id}`}
            entry={entry}
            flatIndex={flatIndex}
            isSelected={flatIndex === selectedIndex}
            onHover={onHover}
            onRun={onRun}
          />
        );
      })}
    </>
  );
}
