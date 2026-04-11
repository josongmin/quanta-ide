import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/features/ide-toast";
import { useIncidentAlert } from "../model/useIncidentAlert";

export function IncidentAlert() {
  const { t } = useTranslation();
  const { match, hide, ignore } = useIncidentAlert();
  const { show: showToast } = useToast();

  useEffect(() => {
    if (!match) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); hide(); }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [match, hide]);

  if (!match) return null;

  return (
    <div className="ialert">
      <header className="ialert-head">
        <div className="ialert-head-left">
          <span className="ialert-icon">!</span>
          <div className="ialert-head-text">
            <div className="ialert-head-title">{t("ide.incident.title")}</div>
            <div className="ialert-head-sub">{t("ide.incident.similarity", { n: match.similarity })}</div>
          </div>
        </div>
        <div className="ialert-conf" data-conf={match.confidence}>
          {match.confidence}
        </div>
      </header>

      <div className="ialert-body">
        <div className="ialert-incident">
          <span className="ialert-id">{match.id}</span>
          <span className="ialert-sev" data-sev={match.severity}>{match.severity}</span>
          <span className="ialert-title">{match.title}</span>
        </div>

        <div className="ialert-rc">
          <span className="ialert-k">{t("ide.incident.rootCause")}</span>
          <span className="ialert-v">{match.rootCause}</span>
        </div>

        <div className="ialert-pattern">
          <span className="ialert-k">{t("ide.incident.match")}</span>
          <div className="ialert-pattern-list">
            {match.pattern.map((p) => (
              <div key={p} className="ialert-pattern-item">
                <span className="ialert-pattern-mark">›</span>
                {p}
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="ialert-foot">
        <button
          type="button"
          className="ialert-btn-ignore"
          onClick={() => {
            ignore(match.id);
            showToast(t("ide.incident.toastIgnore"));
          }}
        >
          {t("ide.incident.ignore")}
        </button>
        <button
          type="button"
          className="ide-btn"
          onClick={() => {
            showToast(t("ide.incident.toastReport"));
            hide();
          }}
        >
          {t("ide.incident.viewReport")}
        </button>
        <button
          type="button"
          className="ide-btn is-primary"
          onClick={() => {
            showToast(t("ide.incident.toastPattern"));
            hide();
          }}
        >
          {t("ide.incident.usePattern")}
        </button>
      </footer>
    </div>
  );
}
