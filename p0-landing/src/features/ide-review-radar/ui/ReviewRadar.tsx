import { useState } from "react";
import { useTranslation } from "react-i18next";
import { dispatchCommand } from "@/features/ide-command-palette";
import { useReviewRadar, RADAR_GROUPS, type RadarItem } from "../model/useReviewRadar";

const KIND_ICON: Record<RadarItem["kind"], string> = {
  review: "◇",
  risk: "▲",
  stale: "○",
  gap: "✕",
};

const TAB_KEY: Record<RadarItem["kind"], string> = {
  review: "ide.radar.tabReview",
  risk: "ide.radar.tabRisk",
  stale: "ide.radar.tabStale",
  gap: "ide.radar.tabGap",
};

export function ReviewRadar() {
  const { t } = useTranslation();
  const { isOpen, toggle } = useReviewRadar();
  const [activeKind, setActiveKind] = useState<RadarItem["kind"]>("review");

  const handleOpen = (item: RadarItem) => {
    switch (item.kind) {
      case "review":
      case "stale":
        dispatchCommand("pr");
        break;
      case "risk":
        dispatchCommand("dead");
        break;
      case "gap":
        dispatchCommand("ownership");
        break;
    }
  };

  const totals = RADAR_GROUPS.reduce<Record<string, number>>((acc, g) => {
    acc[g.kind] = g.items.length;
    return acc;
  }, {});

  const activeGroup = RADAR_GROUPS.find((g) => g.kind === activeKind);

  return (
    <div className={`radar-panel${isOpen ? " is-open" : ""}`}>
      <button type="button" className="radar-head" onClick={toggle}>
        <div className="radar-head-left">
          <span className="radar-head-label">{t("ide.radar.label")}</span>
          <span className="radar-head-sub">{t("ide.radar.sub")}</span>
        </div>
        <div className="radar-head-right">
          <span className="radar-pill">{t("ide.radar.pillReviews", { n: totals.review })}</span>
          <span className="radar-pill is-warn">{t("ide.radar.pillAtRisk", { n: totals.risk })}</span>
          <span className="radar-chev">{isOpen ? "−" : "+"}</span>
        </div>
      </button>

      {isOpen && (
        <div className="radar-body">
          <div className="radar-tabs">
            {RADAR_GROUPS.map((g) => (
              <button
                key={g.kind}
                type="button"
                className={`radar-tab${activeKind === g.kind ? " is-active" : ""}`}
                onClick={() => { setActiveKind(g.kind); }}
              >
                <span className="radar-tab-icon">{KIND_ICON[g.kind]}</span>
                {t(TAB_KEY[g.kind])}
                <span className="radar-tab-count">{g.items.length}</span>
              </button>
            ))}
          </div>

          <div className="radar-list">
            {activeGroup?.items.map((item) => (
              <div key={item.id} className={`radar-item radar-sev-${item.severity.toString()}`}>
                <span className="radar-item-bar" />
                <div className="radar-item-body">
                  <div className="radar-item-title">{item.title}</div>
                  <div className="radar-item-meta">{item.meta}</div>
                </div>
                <button type="button" className="radar-item-action" onClick={() => { handleOpen(item); }}>{t("ide.radar.open")}</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
