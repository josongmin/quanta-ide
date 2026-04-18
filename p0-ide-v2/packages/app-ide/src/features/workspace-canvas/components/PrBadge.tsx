import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { PR } from "../lib/mock-prs";

interface Props {
  pr: PR;
  worldX: number;
  worldY: number;
  stackIndex: number;
}

const HOVER_DELAY_MS = 500;

/**
 * World-positioned pill badge on a file card's top-left. Hovering for
 * 500ms reveals a tooltip with the PR title, +/- stats, and a few
 * lines of diff preview.
 */
const PrBadgeInner = ({ pr, worldX, worldY, stackIndex }: Props) => {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const onEnter = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(true), HOVER_DELAY_MS);
  }, []);

  const onLeave = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setOpen(false);
  }, []);

  const style: CSSProperties = {
    left: worldX + stackIndex * 72,
    top: worldY,
  };

  return (
    <div
      className={`ws-pr-badge ws-pr-badge--${pr.state}`}
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <span className="ws-pr-badge__num">#{pr.number}</span>
      <span className="ws-pr-badge__state">{pr.state}</span>
      {open && (
        <div className="ws-pr-badge__tooltip" role="tooltip">
          <div className="ws-pr-badge__tooltip-title">{pr.title}</div>
          <div className="ws-pr-badge__tooltip-meta">
            by {pr.author} ·{" "}
            <span className="ws-pr-badge__add">+{pr.additions}</span>{" "}
            <span className="ws-pr-badge__del">−{pr.deletions}</span>
          </div>
          <pre className="ws-pr-badge__diff">{pr.diffPreview}</pre>
        </div>
      )}
    </div>
  );
};

export const PrBadge = memo(PrBadgeInner);
