import { memo, useCallback } from "react";
import type { SlackThread } from "../lib/mock-slack";

interface Props {
  thread: SlackThread;
}

function formatAgo(ts: number, now: number = Date.now()): string {
  const delta = Math.max(0, now - ts);
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

/**
 * Slack thread embed — rendered inside the HUD "Related discussions"
 * section rather than world-positioned, so it stays visible while the
 * user pans. Clicking opens the mock URL in a new tab.
 */
const SlackEmbedInner = ({ thread }: Props) => {
  const onClick = useCallback(() => {
    if (typeof window === "undefined") return;
    window.open(thread.url, "_blank", "noopener,noreferrer");
  }, [thread.url]);

  return (
    <button
      type="button"
      className="ws-slack"
      onClick={onClick}
      title={`open ${thread.channel}`}
    >
      <div className="ws-slack__head">
        <span className="ws-slack__glyph" aria-hidden>S</span>
        <span className="ws-slack__channel">{thread.channel}</span>
        <span className="ws-slack__count">{thread.messageCount} msgs</span>
      </div>
      <div className="ws-slack__reply">
        <span className="ws-slack__author">{thread.lastReply.author}</span>:{" "}
        <span className="ws-slack__body">{thread.lastReply.body}</span>
      </div>
      <div className="ws-slack__foot">last reply {formatAgo(thread.lastReply.timestamp)}</div>
    </button>
  );
};

export const SlackEmbed = memo(SlackEmbedInner);
