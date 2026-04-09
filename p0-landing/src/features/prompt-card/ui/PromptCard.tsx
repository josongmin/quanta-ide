import { useRef, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const TYPE_SPEED = 55; // ms per char
const BACKSPACE_SPEED = 22; // ms per char
const HOLD_MS = 2200; // pause after full type
const BETWEEN_MS = 500; // pause after erase

export function PromptCard() {
  const { t, i18n } = useTranslation();
  const ta = useRef<HTMLTextAreaElement>(null);
  const [animated, setAnimated] = useState("");

  // Pull questions from i18n, re-memoise on language change.
  // NOTE: `t(..., { returnObjects: true })` returns a new array each render —
  // memoise by language so the typing effect's deps stay stable.
  const questions = useMemo<string[]>(() => {
    const raw = t("landing.prompt.questions", { returnObjects: true }) as unknown;
    if (Array.isArray(raw) && raw.every((q): q is string => typeof q === "string")) return raw;
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language, t]);

  // Auto-typing loop — system always drives the animation.
  useEffect(() => {
    if (questions.length === 0) return;

    let cancelled = false;
    let qIdx = Math.floor(Math.random() * questions.length);
    let charIdx = 0;
    let phase: "typing" | "holding" | "erasing" | "between" = "typing";
    let timer = 0;

    const step = () => {
      if (cancelled) return;
      const current = questions[qIdx];

      switch (phase) {
        case "typing":
          if (charIdx < current.length) {
            charIdx += 1;
            setAnimated(current.slice(0, charIdx));
            timer = window.setTimeout(step, TYPE_SPEED + Math.random() * 40);
          } else {
            phase = "holding";
            timer = window.setTimeout(step, HOLD_MS);
          }
          return;
        case "holding":
          phase = "erasing";
          timer = window.setTimeout(step, BACKSPACE_SPEED);
          return;
        case "erasing":
          if (charIdx > 0) {
            charIdx -= 1;
            setAnimated(current.slice(0, charIdx));
            timer = window.setTimeout(step, BACKSPACE_SPEED);
          } else {
            phase = "between";
            timer = window.setTimeout(step, BETWEEN_MS);
          }
          return;
        case "between":
          if (questions.length > 1) {
            let next = qIdx;
            while (next === qIdx) next = Math.floor(Math.random() * questions.length);
            qIdx = next;
          }
          phase = "typing";
          timer = window.setTimeout(step, TYPE_SPEED);
      }
    };

    timer = window.setTimeout(step, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [questions, i18n.language]);

  return (
    <div className="card-wrap" id="prompt-dock">
      <div className="card-border">
        <div className="card">
          <div className="card-input">
            <div className="typewriter" aria-hidden="true">
              {animated}
              <span className="caret" />
            </div>
            <textarea
              ref={ta}
              rows={3}
              placeholder=""
              readOnly
              aria-label={t("landing.prompt.ariaLabel")}
            />
          </div>
          <div className="card-divider" />
          <div className="toolbar">
            <div className="toolbar-left">
              <button className="icon-btn" title={t("landing.prompt.attach")} aria-label={t("landing.prompt.attach")}><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></button>
              <button className="tab-btn active"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="3" /><circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" /></svg>{t("landing.prompt.tabApp")}</button>
              <button className="tab-btn inactive"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="2" y1="9" x2="22" y2="9" /><circle cx="5.5" cy="6.5" r="1" fill="currentColor" stroke="none" /><circle cx="8.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>{t("landing.prompt.tabWeb")}</button>
            </div>
            <div className="toolbar-right">
              <button className="icon-btn" title={t("landing.prompt.tone")} aria-label={t("landing.prompt.tone")}><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" /></svg></button>
              <button className="model-btn"><span className="gem">✦</span>3.0 Flash<svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg></button>
              <button className="icon-btn" title={t("landing.prompt.options")} aria-label={t("landing.prompt.options")}><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /><circle cx="7" cy="6" r="2.5" fill="#0d0d12" stroke="currentColor" strokeWidth="2" /><circle cx="15" cy="12" r="2.5" fill="#0d0d12" stroke="currentColor" strokeWidth="2" /><circle cx="10" cy="18" r="2.5" fill="#0d0d12" stroke="currentColor" strokeWidth="2" /></svg></button>
              <button className="send-btn" title={t("landing.prompt.submit")} aria-label={t("landing.prompt.submit")}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
