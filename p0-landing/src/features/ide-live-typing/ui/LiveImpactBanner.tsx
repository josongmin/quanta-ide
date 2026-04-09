import { useTranslation } from "react-i18next";
import { useLiveTyping } from "../model/useLiveTyping";

export function LiveImpactBanner() {
  const { t } = useTranslation();
  const { analysisState, blastDelta, taintDelta, isEditing } = useLiveTyping();

  if (!isEditing) return null;

  return (
    <div className="livebanner">
      {analysisState === "analyzing" && (
        <span className="livebanner-status">{t("ide.liveTyping.impactUpdating")}</span>
      )}
      {analysisState === "done" && (blastDelta > 0 || taintDelta > 0) && (
        <>
          <span className="livebanner-label">{t("ide.liveTyping.banner")}</span>
          {blastDelta > 0 && (
            <span className="livebanner-metric">
              {t("ide.liveTyping.blastLabel")} 31 → {31 + blastDelta}{" "}
              <span className="livebanner-delta">(+{blastDelta})</span>
            </span>
          )}
          {taintDelta > 0 && (
            <span className="livebanner-metric">
              {t("ide.liveTyping.taintLabel")} 2 → {2 + taintDelta}{" "}
              <span className="livebanner-delta">(+{taintDelta})</span>
            </span>
          )}
        </>
      )}
      {analysisState === "done" && blastDelta === 0 && taintDelta === 0 && (
        <span className="livebanner-status">{t("ide.liveTyping.noImpactChange")}</span>
      )}
    </div>
  );
}
