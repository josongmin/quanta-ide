import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ChangeEvent } from "react";
import {
  AVAILABLE_USERS,
  commentsStore,
  type CommentThread,
} from "../store/comments-store";

interface Props {
  thread: CommentThread;
  scale: number;
}

interface MentionMatch {
  query: string;
  start: number;
  end: number;
}

function findMentionAtCursor(text: string, caret: number): MentionMatch | null {
  // Scan backwards from caret to find a @ without a preceding word char; break
  // at whitespace.
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i]!;
    if (ch === "@") {
      const prev = i > 0 ? text[i - 1] : "";
      if (prev === "" || /\s/.test(prev)) {
        return { query: text.slice(i + 1, caret), start: i, end: caret };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i -= 1;
  }
  return null;
}

function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function CommentThreadPopover({ thread, scale }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [mentionMatch, setMentionMatch] = useState<MentionMatch | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);

  const invScale = scale > 0 ? 1 / scale : 1;

  const suggestions = useMemo(() => {
    if (!mentionMatch) return [];
    const q = mentionMatch.query.toLowerCase();
    return AVAILABLE_USERS.filter(u => u.toLowerCase().startsWith(q)).slice(0, 6);
  }, [mentionMatch]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [mentionMatch?.query]);

  const mentioned = useMemo(() => {
    const set = new Set<string>();
    for (const m of thread.messages) for (const u of m.mentions) set.add(u);
    return [...set];
  }, [thread.messages]);

  const onTextChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setDraft(v);
    const caret = e.target.selectionStart ?? v.length;
    setMentionMatch(findMentionAtCursor(v, caret));
  }, []);

  const applyMention = useCallback((user: string) => {
    if (!mentionMatch) return;
    const before = draft.slice(0, mentionMatch.start);
    const after = draft.slice(mentionMatch.end);
    const next = `${before}@${user} ${after}`;
    setDraft(next);
    setMentionMatch(null);
    // Restore focus + place caret after the inserted mention.
    window.requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      const pos = before.length + user.length + 2;
      try { ta.setSelectionRange(pos, pos); } catch { /* ignored */ }
    });
  }, [draft, mentionMatch]);

  const onKeyDown = useCallback((e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionMatch && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx(i => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx(i => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const pick = suggestions[highlightIdx];
        if (pick) applyMention(pick);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionMatch(null);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commitDraft();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      commentsStore.setOpen(null);
    }
    // WHY: `commitDraft` is declared below — it captures `draft`, but we
    // want the handler identity to change only when the mention UI state
    // shifts, not every keystroke (draft changes N×/s).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionMatch, suggestions, highlightIdx, applyMention]);

  const commitDraft = useCallback(() => {
    const body = draft.trim();
    if (body.length === 0) return;
    commentsStore.addMessage(thread.id, body);
    setDraft("");
    setMentionMatch(null);
  }, [draft, thread.id]);

  // Close-on-outside-click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = popoverRef.current;
      if (!el) return;
      const t = e.target as Node | null;
      if (!t) return;
      if (el.contains(t)) return;
      // Also ignore clicks on the pin itself.
      if ((e.target as HTMLElement | null)?.closest?.(`[data-thread-id="${thread.id}"]`)) return;
      commentsStore.setOpen(null);
    };
    window.addEventListener("mousedown", onDown, true);
    return () => window.removeEventListener("mousedown", onDown, true);
  }, [thread.id]);

  return (
    <div
      ref={popoverRef}
      className="ws-comment-popover"
      data-thread-id={thread.id}
      style={{
        left: thread.posX,
        top: thread.posY,
        "--popover-inv-scale": invScale.toFixed(4),
      } as React.CSSProperties}
      onPointerDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <div className="ws-comment-popover__header">
        <span className="ws-comment-popover__title">
          {thread.targetKind === "file" ? "file" : thread.targetKind} · {thread.messages.length} msg
        </span>
        <div className="ws-comment-popover__actions">
          <button
            type="button"
            className="ws-comment-popover__btn"
            onClick={() => commentsStore.toggleLocked(thread.id)}
            title={thread.locked ? "unlock" : "lock"}
          >
            {thread.locked ? "locked" : "lock"}
          </button>
          <button
            type="button"
            className="ws-comment-popover__btn"
            onClick={() => commentsStore.toggleResolved(thread.id)}
            title={thread.resolved ? "reopen" : "resolve"}
          >
            {thread.resolved ? "reopen" : "resolve"}
          </button>
          <button
            type="button"
            className="ws-comment-popover__btn ws-comment-popover__btn--close"
            onClick={() => commentsStore.setOpen(null)}
            title="close"
          >
            ×
          </button>
        </div>
      </div>

      {mentioned.length > 0 && (
        <div className="ws-comment-popover__mentions">
          {mentioned.map(u => (
            <span key={u} className="ws-comment-popover__chip">@{u}</span>
          ))}
        </div>
      )}

      <div className="ws-comment-popover__list">
        {thread.messages.length === 0 ? (
          <div className="ws-comment-popover__empty">no messages yet — start the thread</div>
        ) : (
          thread.messages.map(m => (
            <div key={m.id} className="ws-comment-msg">
              <div className="ws-comment-msg__head">
                <span className="ws-comment-msg__author">{m.author}</span>
                <span className="ws-comment-msg__time">{formatTime(m.createdAt)}</span>
              </div>
              <div className="ws-comment-msg__body">{m.body}</div>
            </div>
          ))
        )}
      </div>

      <div className="ws-comment-popover__compose">
        <textarea
          ref={textareaRef}
          className="ws-comment-popover__textarea"
          value={draft}
          placeholder="reply… use @ to mention"
          onChange={onTextChange}
          onKeyDown={onKeyDown}
          rows={2}
        />
        {mentionMatch && suggestions.length > 0 && (
          <div className="ws-comment-popover__autocomplete">
            {suggestions.map((u, i) => (
              <button
                key={u}
                type="button"
                className={`ws-comment-popover__autocomplete-item${i === highlightIdx ? " is-on" : ""}`}
                onMouseDown={e => { e.preventDefault(); applyMention(u); }}
              >
                @{u}
              </button>
            ))}
          </div>
        )}
        <div className="ws-comment-popover__compose-row">
          <span className="ws-comment-popover__hint">⌘↵ to send</span>
          <button
            type="button"
            className="ws-comment-popover__send"
            disabled={draft.trim().length === 0}
            onClick={commitDraft}
          >
            send
          </button>
        </div>
      </div>
    </div>
  );
}
