import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useOwnershipMap, OWNERSHIP_BANDS } from "../model/useOwnershipMap";

export function OwnershipOverlay() {
  const { t } = useTranslation();
  const { isOpen, close } = useOwnershipMap();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div className="own-overlay" role="dialog" aria-label={t("ide.ownership.title")}>
      <div className="own-head">
        <div className="own-head-label">{t("ide.ownership.mapHead")}</div>
        <div className="own-head-meta">
          {t("ide.ownership.metaHead", { file: "refund.ts", lines: 14, bands: OWNERSHIP_BANDS.length })}
        </div>
        <button type="button" className="own-close" onClick={close} aria-label={t("ide.ownership.closeAria")}>
          {t("ide.ownership.esc")}
        </button>
      </div>

      <div className="own-bands">
        {OWNERSHIP_BANDS.map((band) => (
          <div key={`${band.fromLine.toString()}-${band.toLine.toString()}`} className={`own-band own-${band.health}`}>
            <div className="own-band-rail">
              <span className="own-band-range">L{band.fromLine}–{band.toLine}</span>
              <span className="own-band-tick" />
            </div>

            <div className="own-band-body">
              <div className="own-band-head">
                <span className="own-band-label">{t(`ide.ownership.bands.${band.bandId}.label`)}</span>
                <span className="own-band-tag">{t(`ide.ownership.${band.health}`).toUpperCase()}</span>
              </div>

              <div className="own-band-people">
                {band.primary ? (
                  <div className="own-person">
                    <div className={`own-avatar own-avatar-${band.primary.status}`}>
                      {band.primary.handle.slice(1, 3).toUpperCase()}
                    </div>
                    <div className="own-person-meta">
                      <div className="own-person-name">
                        {band.primary.handle}
                        {band.primary.status === "vacation" && <span className="own-status-pill">{t("ide.ownership.onPTO")}</span>}
                        {band.primary.status === "left" && <span className="own-status-pill is-bad">{t("ide.ownership.leftOrg")}</span>}
                      </div>
                      <div className="own-person-sub">
                        {t("ide.ownership.expertise")}{" "}
                        <strong>{Math.round(band.primary.expertise * 100).toString()}%</strong>
                        <span className="own-dot">·</span>
                        {t("ide.ownership.lastTouched")} {band.primary.lastTouched}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="own-person own-person-orphan">
                    <div className="own-avatar own-avatar-orphan">??</div>
                    <div className="own-person-meta">
                      <div className="own-person-name">{t("ide.ownership.noCurrentOwner")}</div>
                      <div className="own-person-sub">{t("ide.ownership.orphanAssign")}</div>
                    </div>
                  </div>
                )}

                {band.secondary && (
                  <div className="own-person own-person-secondary">
                    <div className={`own-avatar own-avatar-${band.secondary.status}`}>
                      {band.secondary.handle.slice(1, 3).toUpperCase()}
                    </div>
                    <div className="own-person-meta">
                      <div className="own-person-name">
                        {band.secondary.handle}{" "}
                        <span className="own-status-pill">{t("ide.ownership.backup")}</span>
                      </div>
                      <div className="own-person-sub">
                        {t("ide.ownership.expertise")}{" "}
                        <strong>{Math.round(band.secondary.expertise * 100).toString()}%</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="own-band-reason">{t(`ide.ownership.bands.${band.bandId}.reason`)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="own-foot">
        <div className="own-foot-legend">
          <span className="own-legend"><i className="own-dot-owned" />{t("ide.ownership.legendOwned")}</span>
          <span className="own-legend"><i className="own-dot-thin" />{t("ide.ownership.legendThin")}</span>
          <span className="own-legend"><i className="own-dot-orphan" />{t("ide.ownership.legendOrphan")}</span>
        </div>
        <div className="own-foot-hint">{t("ide.ownership.toggleHint")}</div>
      </div>
    </div>
  );
}
