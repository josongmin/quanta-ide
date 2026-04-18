import { memo, useCallback, type CSSProperties } from "react";
import type { Ticket, TicketSource, TicketState } from "../lib/mock-tickets";

interface Props {
  ticket: Ticket;
  worldX: number;
  worldY: number;
  /** Stacking index — N cards for one file are stacked vertically. */
  stackIndex: number;
}

const SOURCE_GLYPH: Record<TicketSource, string> = {
  linear: "L",
  jira: "J",
  github: "G",
};

const STATE_LABEL: Record<TicketState, string> = {
  todo: "todo",
  "in-progress": "in progress",
  "in-review": "in review",
  done: "done",
};

/**
 * World-positioned ticket card pinned to a file's right edge. Purely
 * presentational — the parent TicketsLayer is responsible for feeding
 * correct world coords.
 */
const TicketCardInner = ({ ticket, worldX, worldY, stackIndex }: Props) => {
  const onClick = useCallback(() => {
    if (typeof window === "undefined") return;
    window.open(ticket.url, "_blank", "noopener,noreferrer");
  }, [ticket.url]);

  const style: CSSProperties = {
    left: worldX,
    top: worldY + stackIndex * 44,
  };

  return (
    <button
      type="button"
      className={`ws-ticket ws-ticket--${ticket.state}`}
      style={style}
      onClick={onClick}
      title={`${ticket.externalId} · ${ticket.title}`}
    >
      <span className={`ws-ticket__src ws-ticket__src--${ticket.source}`} aria-hidden>
        {SOURCE_GLYPH[ticket.source]}
      </span>
      <span className="ws-ticket__id">{ticket.externalId}</span>
      <span className="ws-ticket__title">{ticket.title}</span>
      <span className={`ws-ticket__state ws-ticket__state--${ticket.state}`}>
        {STATE_LABEL[ticket.state]}
      </span>
    </button>
  );
};

export const TicketCard = memo(TicketCardInner);
