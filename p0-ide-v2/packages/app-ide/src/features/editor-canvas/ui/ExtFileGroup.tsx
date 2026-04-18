import { memo } from "react";
import type { ExternalFileGroup } from "@quanta/app-ide/entities/canvas";

interface Props {
  group: ExternalFileGroup;
}

export const ExtFileGroup = memo(function ExtFileGroup({ group }: Props) {
  return (
    <div
      className="ext-file-group"
      style={{ left: group.x, top: group.y, width: group.w, height: group.h }}
    >
      <div className="ext-file-group__header">
        <svg className="ext-file-group__icon" width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M4 1.5h5.586a1 1 0 0 1 .707.293l2.414 2.414a1 1 0 0 1 .293.707V13.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        <span className="ext-file-group__name" title={group.fileName}>{group.fileName}</span>
      </div>
    </div>
  );
});
