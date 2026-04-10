import { useState, useRef, useEffect } from "react";
import BoringAvatar from "boring-avatars";
import { useLineComment } from "../model/useLineComment";
import { formatRangeLabel } from "../model/rangeFromSelection";
import { CommentItem } from "./CommentItem";

const AVATAR_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981"];
const ME = { id: "songmin", name: "Song Min" };

interface CommentThreadProps {
  threadId: string;
}

export function CommentThread({ threadId }: CommentThreadProps) {
  const thread = useLineComment((s) => s.threads.find((t) => t.id === threadId));
  const addComment = useLineComment((s) => s.addComment);
  const toggleResolve = useLineComment((s) => s.toggleResolve);

  const [input, setInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [replyingTo]);

  const submit = () => {
    const body = input.trim();
    if (!body) return;
    addComment(threadId, body, ME, replyingTo ?? undefined);
    setInput("");
    setReplyingTo(null);
  };

  const roots = thread?.comments.filter((c) => c.parentId === null) ?? [];
  const replies = (parentId: string) =>
    thread?.comments.filter((c) => c.parentId === parentId) ?? [];

  const rangeLabel = thread ? formatRangeLabel(thread.range) : "";

  return (
    <div className={`lc-thread${thread?.resolved ? " is-resolved" : ""}`}>
      {/* header */}
      <div className="lc-thread-header">
        <span className="lc-thread-range-label">{rangeLabel}</span>
        {thread && (
          <button
            type="button"
            className={`lc-thread-resolve-btn${thread.resolved ? " is-resolved" : ""}`}
            onClick={() => { toggleResolve(thread.id); }}
          >
            {thread.resolved ? (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
                Resolved
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>
                Resolve
              </>
            )}
          </button>
        )}
      </div>

      {/* comment list */}
      {roots.length > 0 && (
        <div className="lc-thread-list">
          {roots.map((root) => (
            <div key={root.id}>
              <CommentItem comment={root} onReply={(id) => { setReplyingTo(id); }} />
              {replies(root.id).map((reply) => (
                <CommentItem key={reply.id} comment={reply} onReply={(id) => { setReplyingTo(id); }} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* input */}
      {!thread?.resolved && (
        <div className="lc-thread-input-wrap">
          {replyingTo && (
            <div className="lc-thread-replying-to">
              <span>Replying to comment</span>
              <button type="button" className="lc-thread-cancel-reply" onClick={() => { setReplyingTo(null); }}>✕</button>
            </div>
          )}
          <div className="lc-thread-input-row">
            <div className="lc-thread-input-avatar">
              <BoringAvatar size={20} name={ME.id} variant="pixel" colors={AVATAR_COLORS} />
            </div>
            <textarea
              ref={textareaRef}
              className="lc-thread-textarea"
              placeholder={replyingTo ? "Write a reply…" : "Add a comment…"}
              value={input}
              rows={1}
              onChange={(e) => { setInput(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button
              type="button"
              className="lc-thread-submit-btn"
              disabled={!input.trim()}
              onClick={submit}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
