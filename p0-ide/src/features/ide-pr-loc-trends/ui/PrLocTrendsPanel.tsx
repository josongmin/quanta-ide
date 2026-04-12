import { useTranslation } from "react-i18next";
import { REPO_DAILY_TRENDS_30D, aggregateRepoTrends } from "../model/trends-data";

export function PrLocTrendsPanel() {
  const { t } = useTranslation();
  const days = REPO_DAILY_TRENDS_30D;
  const { totalPr, totalNetLoc, avgPr, maxPr, maxAbsLoc } = aggregateRepoTrends(days);
  const first = days[0]?.dayShort ?? "";
  const last = days[days.length - 1]?.dayShort ?? "";

  const locSigned = `${totalNetLoc > 0 ? "+" : ""}${totalNetLoc.toLocaleString()}`;
  const summary = t("ide.prLocTrends.ariaSummary", {
    days: days.length,
    pr: totalPr,
    loc: locSigned,
  });

  return (
    <div className="plt" role="region" aria-label={summary}>
      <div className="sii-section-header">
        <span className="sii-section-label">{t("ide.prLocTrends.title")}</span>
      </div>

      <div className="plt-stats">
        <div className="plt-stat">
          <span className="plt-stat-k">{t("ide.prLocTrends.prTotal")}</span>
          <span className="plt-stat-v">{totalPr}</span>
        </div>
        <div className="plt-stat">
          <span className="plt-stat-k">{t("ide.prLocTrends.prAvg")}</span>
          <span className="plt-stat-v">{avgPr}</span>
        </div>
        <div className="plt-stat">
          <span className="plt-stat-k">{t("ide.prLocTrends.netLoc")}</span>
          <span className={`plt-stat-v${totalNetLoc >= 0 ? " plt-stat-v--hi-pos" : " plt-stat-v--hi-neg"}`}>
            {totalNetLoc > 0 ? "+" : ""}
            {totalNetLoc.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="plt-axis" aria-hidden>
        <span>{first}</span>
        <span>{t("ide.prLocTrends.window", { n: days.length })}</span>
        <span>{last}</span>
      </div>

      <div className="plt-row-label">{t("ide.prLocTrends.prDaily")}</div>
      <div className="plt-bars" aria-hidden>
        {days.map((d, i) => {
          const h = Math.round((d.prMerged / maxPr) * 100);
          return (
            <div key={`plt-pr-${i.toString()}`} className="plt-cell" title={`${d.dayShort}: ${d.prMerged} PR`}>
              <div className="plt-bar-pr" style={{ height: `${h}%` }} />
            </div>
          );
        })}
      </div>

      <div className="plt-row-label">{t("ide.prLocTrends.locDaily")}</div>
      <div className="plt-bars plt-bars--loc" aria-hidden>
        {days.map((d, i) => {
          const abs = Math.abs(d.netLoc);
          const h = Math.round((abs / maxAbsLoc) * 50);
          const isPos = d.netLoc >= 0;
          return (
            <div
              key={`plt-loc-${i.toString()}`}
              className="plt-cell plt-cell--loc"
              title={`${d.dayShort}: ${d.netLoc > 0 ? "+" : ""}${d.netLoc.toString()} LOC`}
            >
              <span className="plt-mid" />
              <div
                className={`plt-bar-loc${isPos ? " plt-bar-loc--pos" : " plt-bar-loc--neg"}`}
                style={{ height: `${h}%` }}
              />
            </div>
          );
        })}
      </div>

      <p className="plt-foot">{t("ide.prLocTrends.footnote")}</p>
    </div>
  );
}
