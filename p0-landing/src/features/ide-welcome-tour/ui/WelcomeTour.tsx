import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TOUR_STEPS, useWelcomeTour } from "../model/useWelcomeTour";

export function WelcomeTour() {
  const { t } = useTranslation();
  const { isOpen, step, next, prev, skip } = useWelcomeTour();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { skip(); return; }
      if (e.key === "ArrowRight" || e.key === "Enter") { next(); return; }
      if (e.key === "ArrowLeft") { prev(); }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [isOpen, next, prev, skip]);

  if (!isOpen) return null;

  const current = TOUR_STEPS[step];

  const total = TOUR_STEPS.length;
  const isLast = step === total - 1;

  return (
    <div className={`tour-root tour-pos-${current.position}`} data-target={current.target}>
      <div className="tour-spot" data-target={current.target} />

      <div className="tour-card">
        <div className="tour-step">
          {(step + 1).toString()} <span className="tour-step-sep">/</span> {total}
        </div>
        <div className="tour-title">{t(`ide.tour.s${step.toString()}title`)}</div>
        <div className="tour-body">{t(`ide.tour.s${step.toString()}body`)}</div>
        <div className="tour-actions">
          <button type="button" className="tour-btn-skip" onClick={skip}>
            {t("ide.tour.skip")}
          </button>
          <div className="tour-actions-right">
            {step > 0 && (
              <button type="button" className="ide-btn" onClick={prev}>
                {t("ide.tour.back")}
              </button>
            )}
            <button type="button" className="ide-btn is-primary" onClick={next}>
              {isLast ? t("ide.tour.done") : t("ide.tour.next")}{" "}
              <span className="ide-btn-key">⏎</span>
            </button>
          </div>
        </div>
        <div className="tour-progress">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`tour-dot${i === step ? " is-active" : ""}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
