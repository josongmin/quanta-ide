import type { StackedBranch } from "@quanta/app-ide/stores/git-workspace";
import { IconPrGlyph, IconCloudGlyph } from "../../lib/icons";

export function StackBranchRow({
  row,
  all,
  selected,
  busy,
  onSelect,
}: {
  row: StackedBranch;
  all: StackedBranch[];
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  const inGroup = all.filter((b) => b.stackGroup === row.stackGroup);
  const idx = inGroup.findIndex((b) => b.id === row.id);
  const lineAbove = idx > 0;
  const lineBelow = idx < inGroup.length - 1;

  return (
    <li className="git-stack__li">
      <button type="button" className={`git-stack__row${selected ? " is-selected" : ""}`} disabled={busy} onClick={onSelect}>
        <div className="git-stack__lane" aria-hidden>
          {(lineAbove || lineBelow) && (
            <span
              className={[
                "git-stack__spine",
                lineAbove && lineBelow ? "is-mid" : "",
                lineAbove && !lineBelow ? "is-end" : "",
                !lineAbove && lineBelow ? "is-start" : "",
              ].filter(Boolean).join(" ")}
            />
          )}
          <span className="git-stack__dot" />
        </div>
        <span className="git-stack__name">{row.name}</span>
        <span className="git-stack__icons">
          {row.hasOpenPr && (
            <span className="git-stack__pr-badge" title={row.prNumber != null ? `PR #${row.prNumber}` : "Open PR"}>
              <IconPrGlyph />
            </span>
          )}
          {row.pushedToRemote && (
            <span className="git-stack__pushed" title="On remote">
              <IconCloudGlyph />
            </span>
          )}
        </span>
        <span className="git-stack__time">{row.relativeTime}</span>
      </button>
    </li>
  );
}
