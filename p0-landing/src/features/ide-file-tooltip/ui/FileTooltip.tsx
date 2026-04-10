import { useTranslation } from "react-i18next";
import { smartPos } from "@/features/ide-editor-hover/model/useSmartPos";
import { useFileTooltip } from "../model/useFileTooltip";

function riskDots(level: number, max = 5) {
  return Array.from({ length: max }, (_, i) => (
    <span key={i} className={`ftip-dot${i < level ? " on" : ""}`} />
  ));
}

const RISK_KEYS = ["", "low", "moderate", "elevated", "high", "critical"] as const;

export function FileTooltip() {
  const { t } = useTranslation();
  const { meta, x, y } = useFileTooltip();
  if (!meta) return null;

  const W = 340;
  const ESTIMATED_H = meta.type === "file" ? 380 : 260;
  const { left, top } = smartPos(x, y, W, ESTIMATED_H);

  const isFile = meta.type === "file";

  const riskWord = (level: number) => {
    const key = RISK_KEYS[level];
    return key ? t(`ide.fileTooltip.riskLevel.${key}`) : "";
  };

  return (
    <div className="ftip" style={{ left, top, width: W }}>
      <div className="ftip-head">
        <span className="ftip-name">{meta.name}</span>
        <span className="ftip-path">
          {meta.path}
          {isFile
            ? ""
            : t("ide.fileTooltip.filesLocLine", {
                count: meta.fileCount ?? 0,
                loc: meta.totalLoc ?? 0,
              })}
        </span>
      </div>

      <div className="ftip-body">
        {/* Risk / Health */}
        {isFile && meta.risk !== undefined && (
          <div className="ftip-row">
            <span className="ftip-k">{t("ide.fileTooltip.riskLabel")}</span>
            <span className="ftip-v ftip-dots">
              {riskDots(meta.risk)}
              <span className="ftip-risk-label">{riskWord(meta.risk)}</span>
            </span>
          </div>
        )}
        {!isFile && meta.health !== undefined && (
          <div className="ftip-row">
            <span className="ftip-k">{t("ide.fileTooltip.health")}</span>
            <span className="ftip-v ftip-dots">
              {riskDots(meta.health)}
              <span className="ftip-risk-label">{riskWord(meta.health)}</span>
            </span>
          </div>
        )}

        {/* Blast */}
        {isFile && meta.blast !== undefined && (
          <div className="ftip-row">
            <span className="ftip-k">{t("ide.changeCard.blast")}</span>
            <span className="ftip-v">
              {meta.blast} {t("ide.fileTooltip.blastFiles")}
            </span>
          </div>
        )}
        {!isFile && meta.hottest && (
          <div className="ftip-row">
            <span className="ftip-k">{t("ide.fileTooltip.hottest")}</span>
            <span className="ftip-v">
              {t("ide.fileTooltip.hottestFmt", { name: meta.hottest.name, blast: meta.hottest.blast })}
            </span>
          </div>
        )}

        {/* Complexity */}
        {isFile && meta.complexity !== undefined && (
          <div className="ftip-row">
            <span className="ftip-k">{t("ide.fileTooltip.complexity")}</span>
            <span className="ftip-v">{t("ide.fileTooltip.complexityAvg", { n: meta.complexity.toFixed(1) })}</span>
          </div>
        )}

        {/* Coverage */}
        {meta.coverage !== undefined && (
          <div className="ftip-row">
            <span className="ftip-k">{t("ide.fileTooltip.coverage")}</span>
            <span className={`ftip-v${meta.coverage < 30 ? " ftip-warn" : ""}`}>
              {meta.coverage}%{meta.coverage === 0 ? "  ⚠" : ""}
            </span>
          </div>
        )}

        {/* Taint */}
        {isFile && meta.taintPaths !== undefined && meta.taintPaths > 0 && (
          <div className="ftip-row">
            <span className="ftip-k">{t("ide.symtip.taint")}</span>
            <span className="ftip-v">{t("ide.fileTooltip.taintThrough", { n: meta.taintPaths })}</span>
          </div>
        )}

        {/* Dead code (folder) */}
        {!isFile && meta.deadCode && (
          <div className="ftip-row">
            <span className="ftip-k">{t("ide.fileTooltip.deadCode")}</span>
            <span className="ftip-v">{meta.deadCode}</span>
          </div>
        )}
      </div>

      <div className="ftip-divider" />

      <div className="ftip-body">
        {/* Owner */}
        {isFile && meta.owner && (
          <div className="ftip-row">
            <span className="ftip-k">{t("ide.fileTooltip.owner")}</span>
            <span className="ftip-v ftip-mono">{meta.owner}</span>
          </div>
        )}

        {/* Team (folder) */}
        {!isFile && meta.team && (
          <div className="ftip-row">
            <span className="ftip-k">{t("ide.fileTooltip.team")}</span>
            <span className="ftip-v ftip-mono">
              {meta.team.map((tm) => `${tm.name} ${tm.pct.toString()}%`).join(" · ")}
            </span>
          </div>
        )}

        {/* Last edit */}
        {isFile && meta.lastEdit && (
          <div className="ftip-row">
            <span className="ftip-k">{t("ide.fileTooltip.lastEdit")}</span>
            <span className="ftip-v">
              {meta.lastEdit}
              {meta.lastEditMsg && <span className="ftip-dim"> · &quot;{meta.lastEditMsg}&quot;</span>}
            </span>
          </div>
        )}

        {/* Churn */}
        {isFile && meta.churn && (
          <div className="ftip-row">
            <span className="ftip-k">{t("ide.fileTooltip.churn")}</span>
            <span className="ftip-v">{meta.churn}</span>
          </div>
        )}

        {/* Bus factor */}
        {meta.busFactor !== undefined && (
          <div className="ftip-row">
            <span className="ftip-k">{t("ide.fileTooltip.busFactor")}</span>
            <span className={`ftip-v${meta.busFactor <= 1 ? " ftip-warn" : ""}`}>
              {meta.busFactor}{meta.busFactor <= 1 ? "  ⚠" : ""}
            </span>
          </div>
        )}

        {/* Incidents (folder) */}
        {!isFile && meta.incidents !== undefined && meta.incidents > 0 && (
          <div className="ftip-row">
            <span className="ftip-k">{t("ide.fileTooltip.incidents")}</span>
            <span className="ftip-v">{t("ide.fileTooltip.incidentsMo", { n: meta.incidents })}</span>
          </div>
        )}
      </div>

      {/* Predictive — RFC tier 3 */}
      {isFile && (meta.incidentMatch !== undefined || meta.changeForecast !== undefined || meta.activePr !== undefined) && (
        <>
          <div className="ftip-divider" />
          <div className="ftip-body ftip-predict">
            {meta.incidentMatch !== undefined && (
              <div className="ftip-row">
                <span className="ftip-k">{t("ide.fileTooltip.incident")}</span>
                <span className="ftip-v ftip-warn">
                  {meta.incidentMatch.id}
                  <span className="ftip-dim">
                    {" "}
                    · {t("ide.fileTooltip.matchPct", { n: meta.incidentMatch.similarity })}
                  </span>
                </span>
              </div>
            )}
            {meta.changeForecast !== undefined && (
              <div className="ftip-row">
                <span className="ftip-k">{t("ide.fileTooltip.ifEdited")}</span>
                <span className="ftip-v">
                  {t("ide.fileTooltip.testsAtRiskLine", { n: meta.changeForecast.tests })}
                  {meta.changeForecast.uncovered > 0 && (
                    <span className="ftip-warn">
                      {" "}
                      · {meta.changeForecast.uncovered} {t("ide.fileTooltip.uncovered")}
                    </span>
                  )}
                </span>
              </div>
            )}
            {meta.activePr !== undefined && (
              <div className="ftip-row">
                <span className="ftip-k">{t("ide.fileTooltip.activePr")}</span>
                <span className="ftip-v ftip-mono">
                  {meta.activePr.num} <span className="ftip-dim">· {meta.activePr.author}</span>
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Exports / Imports (file only) */}
      {isFile && (
        <>
          <div className="ftip-divider" />
          <div className="ftip-body">
            {meta.exports && meta.exports.length > 0 && (
              <div className="ftip-row">
                <span className="ftip-k">{t("ide.fileTooltip.exports")}</span>
                <span className="ftip-v ftip-mono">{meta.exports.join(", ")}</span>
              </div>
            )}
            {meta.importsInternal !== undefined && (
              <div className="ftip-row">
                <span className="ftip-k">{t("ide.fileTooltip.imports")}</span>
                <span className="ftip-v">
                  {t("ide.fileTooltip.importsLine", {
                    n: meta.importsInternal,
                    e: meta.importsExternal ?? 0,
                  })}
                </span>
              </div>
            )}
            {meta.dependents !== undefined && (
              <div className="ftip-row">
                <span className="ftip-k">{t("ide.fileTooltip.dependents")}</span>
                <span className="ftip-v">{t("ide.fileTooltip.dependentsLine", { n: meta.dependents })}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Arch layer (folder) */}
      {!isFile && meta.archLayer && (
        <>
          <div className="ftip-divider" />
          <div className="ftip-body">
            <div className="ftip-row">
              <span className="ftip-k">{t("ide.fileTooltip.archLayer")}</span>
              <span className="ftip-v">{meta.archLayer}</span>
            </div>
            {meta.violations !== undefined && meta.violations > 0 && (
              <div className="ftip-row">
                <span className="ftip-k">{t("ide.fileTooltip.violations")}</span>
                <span className="ftip-v ftip-warn">{meta.violations}</span>
              </div>
            )}
            {meta.depDrift !== undefined && (
              <div className="ftip-row">
                <span className="ftip-k">{t("ide.fileTooltip.depDrift")}</span>
                <span className="ftip-v">
                  ↔ {meta.depDrift.target}
                  <span className="ftip-warn"> +{meta.depDrift.pct}%</span>
                  <span className="ftip-dim"> / 30d</span>
                </span>
              </div>
            )}
          </div>
        </>
      )}

      <div className="ftip-foot">
        <span className="ftip-kbd">⌘↵</span> {t("ide.fileTooltip.footOpen")}
        <span className="ftip-kbd">⌘B</span> {t("ide.fileTooltip.footBlast")}
        {isFile && (
          <>
            <span className="ftip-kbd">⌘.</span> {t("ide.fileTooltip.footFlow")}
          </>
        )}
      </div>
    </div>
  );
}
