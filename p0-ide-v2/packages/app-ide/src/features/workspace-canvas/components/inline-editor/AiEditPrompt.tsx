import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  inlineEditorStore,
  useInlineEditorStore,
  type AiEditStatus,
} from "../../store/inline-editor-store";

// AiEditPrompt
// -------------------------------------------------------------------
// Cursor Cmd+K-style floating prompt: a narrow glass card that sits
// above the caret, hosts a single-line prompt box, and streams the
// model's suggested replacement as a diff. Accept (⏎ / Tab) applies
// the suggestion; Reject (⎋) closes the popup and discards it.
//
// The popup portals to document.body so it escapes the canvas's
// CSS-transform and renders at screen-anchored, non-scaled size. The
// InlineCodeEditor owns the actual text-replacement dispatch — this
// component is stateless over the draft and only controls the prompt +
// streaming UI.

interface Props {
  /** Current document — used to show original text for the diff view. */
  doc: string;
  /** Invoked with the user's prompt once they press Enter / click Apply. */
  onSubmit: (prompt: string) => void;
  /** Apply the currently-streamed suggestion into the editor. */
  onAccept: (replacement: string) => void;
  /** Close and discard. */
  onReject: () => void;
}

export function AiEditPrompt({ doc, onSubmit, onAccept, onReject }: Props) {
  const anchor = useInlineEditorStore(s => s.ai.anchor);
  const prompt = useInlineEditorStore(s => s.ai.prompt);
  const status = useInlineEditorStore(s => s.ai.status);
  const suggestion = useInlineEditorStore(s => s.ai.suggestion);
  const selFrom = useInlineEditorStore(s => s.ai.anchor?.selFrom ?? 0);
  const selTo = useInlineEditorStore(s => s.ai.anchor?.selTo ?? 0);
  const errorMessage = useInlineEditorStore(s => s.ai.errorMessage);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Autofocus the textarea on open — matches Cursor Cmd+K UX.
    if (status === "prompting") inputRef.current?.focus();
  }, [status]);

  const handleInputKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim().length > 0 && status === "prompting") onSubmit(prompt);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onReject();
    }
  }, [prompt, status, onSubmit, onReject]);

  const handleAcceptKey = useCallback((e: KeyboardEvent) => {
    // Tab or ⏎ accepts when ready / streaming; ⎋ rejects at any time.
    if (status === "idle" || status === "prompting") return;
    if (e.key === "Escape") {
      e.preventDefault();
      onReject();
    } else if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
      if (status === "ready") {
        e.preventDefault();
        onAccept(suggestion);
      }
    }
  }, [status, suggestion, onAccept, onReject]);

  useEffect(() => {
    if (status === "streaming" || status === "ready") {
      window.addEventListener("keydown", handleAcceptKey, true);
      return () => window.removeEventListener("keydown", handleAcceptKey, true);
    }
    return;
  }, [status, handleAcceptKey]);

  if (!anchor) return null;

  const originalSelection = doc.slice(selFrom, selTo);

  // Position above-left of the caret with a small offset; clamp to
  // viewport so the popup never renders off-screen.
  const POPUP_W = 420;
  const POPUP_MARGIN = 12;
  const rawLeft = anchor.screenX - 12;
  const left = Math.max(POPUP_MARGIN, Math.min(window.innerWidth - POPUP_W - POPUP_MARGIN, rawLeft));
  const top = Math.max(POPUP_MARGIN, anchor.screenY - 12 - 56);

  const body = (
    <div
      className="ai-edit-prompt"
      style={{ left, top, width: POPUP_W }}
      role="dialog"
      aria-label="AI inline edit"
      onMouseDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <div className="ai-edit-prompt__header">
        <span className="ai-edit-prompt__badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2v4M15 2v4M3 11h18M3 6h18v16H3z"/>
          </svg>
          AI Edit
        </span>
        <StatusChip status={status} />
      </div>

      <textarea
        ref={inputRef}
        className="ai-edit-prompt__input"
        placeholder="Describe the change… (e.g. extract this into a helper)"
        rows={2}
        value={prompt}
        disabled={status !== "prompting"}
        onChange={e => inlineEditorStore.setAiPrompt(e.target.value)}
        onKeyDown={handleInputKey}
      />

      {(status === "streaming" || status === "ready") && (
        <div className="ai-edit-prompt__diff">
          {originalSelection.length > 0 && (
            <pre className="ai-edit-prompt__diff-line ai-edit-prompt__diff-line--removed">
              {originalSelection}
            </pre>
          )}
          <pre className="ai-edit-prompt__diff-line ai-edit-prompt__diff-line--added">
            {suggestion}
            {status === "streaming" && <span className="ai-edit-prompt__caret" />}
          </pre>
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="ai-edit-prompt__error">{errorMessage}</div>
      )}

      <div className="ai-edit-prompt__footer">
        {status === "prompting" && (
          <>
            <kbd>⏎</kbd><span>Generate</span>
            <kbd>⎋</kbd><span>Close</span>
          </>
        )}
        {status === "streaming" && (
          <>
            <span className="ai-edit-prompt__streaming">streaming…</span>
            <kbd>⎋</kbd><span>Cancel</span>
          </>
        )}
        {status === "ready" && (
          <>
            <button
              type="button"
              className="ai-edit-prompt__btn ai-edit-prompt__btn--primary"
              onClick={() => onAccept(suggestion)}
            >
              Accept
            </button>
            <kbd>⇥</kbd><span>Accept</span>
            <kbd>⎋</kbd><span>Reject</span>
          </>
        )}
        {status === "error" && (
          <>
            <button
              type="button"
              className="ai-edit-prompt__btn"
              onClick={() => inlineEditorStore.setAiPrompt(prompt)}
            >
              Try again
            </button>
            <kbd>⎋</kbd><span>Close</span>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(body, document.body);
}

function StatusChip({ status }: { status: AiEditStatus }) {
  if (status === "streaming") {
    return (
      <span className="ai-edit-prompt__chip ai-edit-prompt__chip--streaming">
        <span className="ai-edit-prompt__dot" />
        generating
      </span>
    );
  }
  if (status === "ready") {
    return <span className="ai-edit-prompt__chip ai-edit-prompt__chip--ready">ready</span>;
  }
  if (status === "error") {
    return <span className="ai-edit-prompt__chip ai-edit-prompt__chip--error">error</span>;
  }
  return null;
}
