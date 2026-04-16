import type { FileGroup } from "@quanta/app-ide/entities/canvas";
import { cn } from "@quanta/ui-kit/lib";

interface Props {
  group: FileGroup;
}

function riskTone(score: number): "high" | "mid" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

export function FileGroupBg({ group }: Props) {
  const tone = riskTone(group.riskScore);

  return (
    <div
      className="file-group"
      style={{ left: group.x, top: group.y, width: group.w, height: group.h }}
    >
      <div className="file-group__header">
        {/* File icon */}
        <svg
          className="file-group__icon"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path
            d="M4 1.5h5.586a1 1 0 0 1 .707.293l2.414 2.414a1 1 0 0 1 .293.707V13.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M9.5 1.5V4a.5.5 0 0 0 .5.5h2.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
        <span className="file-group__name">{group.name}</span>
        <span className="file-group__meta">{group.loc} loc</span>
        <span className="file-group__meta">@{group.owner}</span>
        <span className="file-group__spacer" />
        <span className={cn("file-group__risk", `file-group__risk--${tone}`)}>
          {group.riskScore}
        </span>
      </div>
    </div>
  );
}
