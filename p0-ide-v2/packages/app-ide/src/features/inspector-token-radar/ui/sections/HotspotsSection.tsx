import type { AgentRun, ToolName } from "@quanta/app-ide/entities/token-radar";
import { fmtBytes, fmtPct, fmtTokens, fmtUsd, LinearBar, SectionTitle } from "./helpers";

const TOOL_LABEL: Record<ToolName, string> = {
  read: "Read",
  grep: "Grep",
  bash: "Bash",
  edit: "Edit",
  web:  "WebFetch",
  task: "Task",
};

/**
 * TIER 2 — File hotspot + Tool ROI + Test log bloat.
 * Three side-by-side cards. The focused file is highlighted in the hotspot list.
 */
export function HotspotsSection({ run }: { run: AgentRun }) {
  const sortedHotspots = [...run.fileHotspots].sort((a, b) => b.tokens - a.tokens);
  const topShare = sortedHotspots[0]?.share ?? 1;

  return (
    <div className="tr-pane__section">
      <SectionTitle
        tier="t2"
        title="Hotspots & tool ROI"
        hint="where token spend concentrates"
      />

      <div className="tr-pane__hotspot-grid">
        <article className="tr-pane__card">
          <div className="tr-pane__card-h">
            file hotspot map <span className="tr-pane__card-badge">{sortedHotspots.length}</span>
          </div>
          <ul className="tr-pane__hotspot-list">
            {sortedHotspots.map((h) => (
              <li
                key={h.fileName}
                className={`tr-pane__hotspot-row${h.isFocused ? " is-focused" : ""}`}
              >
                <div className="tr-pane__hotspot-row-h">
                  <code className="tr-pane__mono">{h.fileName}</code>
                  {h.isFocused && <span className="tr-pane__chip tr-pane__chip--info">focused</span>}
                  <span className="tr-pane__hotspot-tokens">{fmtTokens(h.tokens)}</span>
                </div>
                <div className="tr-pane__hotspot-bar">
                  <LinearBar value={h.share / Math.max(topShare, 0.0001)} toneCls="tr-pane__bar-fill--info" height={6} />
                </div>
                <div className="tr-pane__hotspot-meta">
                  <span>{fmtPct(h.share)}</span>
                  <span>· {h.reads} reads</span>
                  <span>· {h.modifies} mods</span>
                  {h.reverts > 0 && <span className="tr-pane__hotspot-rev">· {h.reverts} reverts</span>}
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="tr-pane__card">
          <div className="tr-pane__card-h">tool ROI / dead calls</div>
          <div className="tr-pane__tools-head">
            <span>tool</span>
            <span>calls</span>
            <span>cost</span>
            <span>dead</span>
            <span>output p50/p95</span>
          </div>
          <ul className="tr-pane__tools">
            {run.tools.map((t) => {
              const deadTone = t.deadRatio >= 0.3 ? "bad" : t.deadRatio >= 0.15 ? "warn" : "ok";
              return (
                <li key={t.tool} className="tr-pane__tools-row">
                  <span className="tr-pane__chip">{TOOL_LABEL[t.tool]}</span>
                  <span className="tr-pane__mono">{t.calls}</span>
                  <span className="tr-pane__mono">{fmtUsd(t.costUsd)}</span>
                  <span className={`tr-pane__mono tr-pane__tools-dead--${deadTone}`}>
                    {fmtPct(t.deadRatio)}
                  </span>
                  <span className="tr-pane__mono">{t.outputKbP50}/{t.outputKbP95} KB</span>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="tr-pane__card">
          <div className="tr-pane__card-h">test log bloat monitor</div>
          <div className="tr-pane__bloat-stats">
            <div className="tr-pane__bloat-stat">
              <div className="tr-pane__bloat-v">{fmtBytes(run.testLogBloat.rawBytes)}</div>
              <div className="tr-pane__bloat-k">raw injected</div>
            </div>
            <div className="tr-pane__bloat-stat">
              <div className="tr-pane__bloat-v">{fmtBytes(run.testLogBloat.compressedBytes)}</div>
              <div className="tr-pane__bloat-k">compressed</div>
            </div>
            <div className="tr-pane__bloat-stat">
              <div className="tr-pane__bloat-v tr-pane__bloat-v--ok">{run.testLogBloat.savingsPct.toFixed(1)}%</div>
              <div className="tr-pane__bloat-k">savings</div>
            </div>
          </div>
          <div className="tr-pane__bloat-bar">
            <LinearBar value={run.testLogBloat.savingsPct / 100} toneCls="tr-pane__bar-fill--ok" height={6} />
          </div>
          {run.testLogBloat.topRecurringFailures.length > 0 ? (
            <ul className="tr-pane__bloat-fails">
              <li className="tr-pane__bloat-fails-h">top recurring failures</li>
              {run.testLogBloat.topRecurringFailures.map((f, i) => (
                <li key={i} className="tr-pane__bloat-fail-row">
                  <span className="tr-pane__chip tr-pane__chip--warn">{f.count}×</span>
                  <code className="tr-pane__mono">{f.message}</code>
                </li>
              ))}
            </ul>
          ) : (
            <div className="tr-pane__empty-row">no recurring failures</div>
          )}
        </article>
      </div>
    </div>
  );
}
