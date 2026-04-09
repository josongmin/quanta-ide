import { useFileTooltip } from "../model/useFileTooltip";

function riskDots(level: number, max = 5) {
  return Array.from({ length: max }, (_, i) => (
    <span key={i} className={`ftip-dot${i < level ? " on" : ""}`} />
  ));
}

const RISK_LABELS = ["", "low", "moderate", "elevated", "high", "critical"];

export function FileTooltip() {
  const { meta, x, y } = useFileTooltip();
  if (!meta) return null;

  const W = 340;
  const left = Math.min(x + 12, window.innerWidth - W - 16);
  const top = Math.min(y, window.innerHeight - 400);

  const isFile = meta.type === "file";

  return (
    <div className="ftip" style={{ left, top, width: W }}>
      <div className="ftip-head">
        <span className="ftip-name">{meta.name}</span>
        <span className="ftip-path">
          {meta.path}
          {isFile ? "" : `${meta.fileCount?.toString() ?? ""} files · ${meta.totalLoc ?? ""} L`}
        </span>
      </div>

      <div className="ftip-body">
        {/* Risk / Health */}
        {isFile && meta.risk !== undefined && (
          <div className="ftip-row">
            <span className="ftip-k">Risk</span>
            <span className="ftip-v ftip-dots">
              {riskDots(meta.risk)}
              <span className="ftip-risk-label">{RISK_LABELS[meta.risk]}</span>
            </span>
          </div>
        )}
        {!isFile && meta.health !== undefined && (
          <div className="ftip-row">
            <span className="ftip-k">Health</span>
            <span className="ftip-v ftip-dots">
              {riskDots(meta.health)}
              <span className="ftip-risk-label">{RISK_LABELS[meta.health]}</span>
            </span>
          </div>
        )}

        {/* Blast */}
        {isFile && meta.blast !== undefined && (
          <div className="ftip-row">
            <span className="ftip-k">Blast</span>
            <span className="ftip-v">{meta.blast} files affected</span>
          </div>
        )}
        {!isFile && meta.hottest && (
          <div className="ftip-row">
            <span className="ftip-k">Hottest</span>
            <span className="ftip-v">{meta.hottest.name} (blast {meta.hottest.blast})</span>
          </div>
        )}

        {/* Complexity */}
        {isFile && meta.complexity !== undefined && (
          <div className="ftip-row">
            <span className="ftip-k">Complexity</span>
            <span className="ftip-v">{meta.complexity.toFixed(1)} avg</span>
          </div>
        )}

        {/* Coverage */}
        {meta.coverage !== undefined && (
          <div className="ftip-row">
            <span className="ftip-k">Coverage</span>
            <span className={`ftip-v${meta.coverage < 30 ? " ftip-warn" : ""}`}>
              {meta.coverage}%{meta.coverage === 0 ? "  ⚠" : ""}
            </span>
          </div>
        )}

        {/* Taint */}
        {isFile && meta.taintPaths !== undefined && meta.taintPaths > 0 && (
          <div className="ftip-row">
            <span className="ftip-k">Taint</span>
            <span className="ftip-v">{meta.taintPaths} paths through</span>
          </div>
        )}

        {/* Dead code (folder) */}
        {!isFile && meta.deadCode && (
          <div className="ftip-row">
            <span className="ftip-k">Dead code</span>
            <span className="ftip-v">{meta.deadCode}</span>
          </div>
        )}
      </div>

      <div className="ftip-divider" />

      <div className="ftip-body">
        {/* Owner */}
        {isFile && meta.owner && (
          <div className="ftip-row">
            <span className="ftip-k">Owner</span>
            <span className="ftip-v ftip-mono">{meta.owner}</span>
          </div>
        )}

        {/* Team (folder) */}
        {!isFile && meta.team && (
          <div className="ftip-row">
            <span className="ftip-k">Team</span>
            <span className="ftip-v ftip-mono">
              {meta.team.map((t) => `${t.name} ${t.pct.toString()}%`).join(" · ")}
            </span>
          </div>
        )}

        {/* Last edit */}
        {isFile && meta.lastEdit && (
          <div className="ftip-row">
            <span className="ftip-k">Last edit</span>
            <span className="ftip-v">
              {meta.lastEdit}
              {meta.lastEditMsg && <span className="ftip-dim"> · "{meta.lastEditMsg}"</span>}
            </span>
          </div>
        )}

        {/* Churn */}
        {isFile && meta.churn && (
          <div className="ftip-row">
            <span className="ftip-k">Churn</span>
            <span className="ftip-v">{meta.churn}</span>
          </div>
        )}

        {/* Bus factor */}
        {meta.busFactor !== undefined && (
          <div className="ftip-row">
            <span className="ftip-k">Bus factor</span>
            <span className={`ftip-v${meta.busFactor <= 1 ? " ftip-warn" : ""}`}>
              {meta.busFactor}{meta.busFactor <= 1 ? "  ⚠" : ""}
            </span>
          </div>
        )}

        {/* Incidents (folder) */}
        {!isFile && meta.incidents !== undefined && meta.incidents > 0 && (
          <div className="ftip-row">
            <span className="ftip-k">Incidents</span>
            <span className="ftip-v">{meta.incidents} in last 6mo</span>
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
                <span className="ftip-k">Incident</span>
                <span className="ftip-v ftip-warn">
                  {meta.incidentMatch.id}
                  <span className="ftip-dim"> · {meta.incidentMatch.similarity}% match</span>
                </span>
              </div>
            )}
            {meta.changeForecast !== undefined && (
              <div className="ftip-row">
                <span className="ftip-k">If edited</span>
                <span className="ftip-v">
                  {meta.changeForecast.tests} tests at risk
                  {meta.changeForecast.uncovered > 0 && (
                    <span className="ftip-warn"> · {meta.changeForecast.uncovered} uncovered</span>
                  )}
                </span>
              </div>
            )}
            {meta.activePr !== undefined && (
              <div className="ftip-row">
                <span className="ftip-k">Active PR</span>
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
                <span className="ftip-k">Exports</span>
                <span className="ftip-v ftip-mono">{meta.exports.join(", ")}</span>
              </div>
            )}
            {meta.importsInternal !== undefined && (
              <div className="ftip-row">
                <span className="ftip-k">Imports</span>
                <span className="ftip-v">{meta.importsInternal} internal · {meta.importsExternal ?? 0} external</span>
              </div>
            )}
            {meta.dependents !== undefined && (
              <div className="ftip-row">
                <span className="ftip-k">Dependents</span>
                <span className="ftip-v">{meta.dependents} files import this</span>
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
              <span className="ftip-k">Arch layer</span>
              <span className="ftip-v">{meta.archLayer}</span>
            </div>
            {meta.violations !== undefined && meta.violations > 0 && (
              <div className="ftip-row">
                <span className="ftip-k">Violations</span>
                <span className="ftip-v ftip-warn">{meta.violations}</span>
              </div>
            )}
            {meta.depDrift !== undefined && (
              <div className="ftip-row">
                <span className="ftip-k">Dep drift</span>
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
        <span className="ftip-kbd">⌘↵</span> open
        <span className="ftip-kbd">⌘B</span> blast
        {isFile && <><span className="ftip-kbd">⌘.</span> flow</>}
      </div>
    </div>
  );
}
