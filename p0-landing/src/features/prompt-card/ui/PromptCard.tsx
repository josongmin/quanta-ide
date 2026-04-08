import { useRef, useCallback } from "react";

export function PromptCard() {
  const ta = useRef<HTMLTextAreaElement>(null);
  const onInput = useCallback(() => { const el = ta.current; if (!el) return; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }, []);

  return (
    <div className="card-wrap" id="prompt-dock">
      <div className="card-border">
        <div className="card">
          <textarea ref={ta} rows={3} placeholder="What native mobile app shall we design?" aria-label="Design prompt" onInput={onInput} />
          <div className="card-divider" />
          <div className="toolbar">
            <div className="toolbar-left">
              <button className="icon-btn" title="Attach"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></button>
              <button className="tab-btn active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="3" /><circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" /></svg>App</button>
              <button className="tab-btn inactive"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="2" y1="9" x2="22" y2="9" /><circle cx="5.5" cy="6.5" r="1" fill="currentColor" stroke="none" /><circle cx="8.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>Web</button>
            </div>
            <div className="toolbar-right">
              <button className="icon-btn" title="Tone"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" /></svg></button>
              <button className="model-btn"><span className="gem">✦</span>3.0 Flash<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg></button>
              <button className="icon-btn" title="Options"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /><circle cx="7" cy="6" r="2.5" fill="#0d0d12" stroke="currentColor" strokeWidth="2" /><circle cx="15" cy="12" r="2.5" fill="#0d0d12" stroke="currentColor" strokeWidth="2" /><circle cx="10" cy="18" r="2.5" fill="#0d0d12" stroke="currentColor" strokeWidth="2" /></svg></button>
              <button className="send-btn" title="Submit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
