import BoringAvatar from "boring-avatars";
import type { Comment } from "../model/types";
import { relativeTime } from "../model/useLineComment";

const AVATAR_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981"];

interface CommentItemProps {
  comment: Comment;
  onReply: (parentId: string) => void;
}

export function CommentItem({ comment, onReply }: CommentItemProps) {
  const isReply = comment.parentId !== null;
  return (
    <div className={`lc-item${isReply ? " is-reply" : ""}`}>
      <div className="lc-item-avatar">
        <BoringAvatar size={20} name={comment.author.id} variant="beam" colors={AVATAR_COLORS} />
      </div>
      <div className="lc-item-body">
        <div className="lc-item-meta">
          <span className="lc-item-name">{comment.author.name}</span>
          <span className="lc-item-time">{relativeTime(comment.createdAt)}</span>
        </div>
        <p className="lc-item-text">{comment.body}</p>
        <button
          type="button"
          className="lc-item-reply-btn"
          onClick={() => { onReply(comment.id); }}
        >
          Reply
        </button>
      </div>
    </div>
  );
}
