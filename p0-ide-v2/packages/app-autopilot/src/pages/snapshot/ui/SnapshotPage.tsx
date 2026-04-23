import { useAutopilot } from "@quanta/app-autopilot/stores";
import { Chip, SectionHeader } from "@quanta/app-autopilot/shared/ui/primitives";
import { Sparkline } from "@quanta/app-autopilot/shared/ui/viz";
import { findMetric, formatMetricValue } from "@quanta/app-autopilot/entities/metric";
import { formatAbsolute } from "@quanta/app-autopilot/shared/lib";
import "./snapshot-page.css";

export function SnapshotPage() {
  const snapshot = useAutopilot((s) => s.snapshot);

  const metrics = Object.entries(snapshot.metrics);

  return (
    <div className="ap-snap ap-container ap-container--wide">
      <SectionHeader
        eyebrow="Snapshot"
        title="Repo state the goals evaluate against"
        subtitle="Static analyzer output — ARE consumes this as input and never mutates it. Pinned metric versions live on each goal."
        trailing={
          <div className="ap-snap__head-meta">
            <Chip tone="muted" mono>{snapshot.id}</Chip>
            <Chip tone="muted" mono>{snapshot.repoRevision}</Chip>
            <Chip tone="muted">{formatAbsolute(snapshot.capturedAt)}</Chip>
          </div>
        }
      />

      <section className="ap-snap__metrics">
        <div className="ap-snap__metrics-head">Metrics</div>
        <ul className="ap-snap__metric-list">
          {metrics.map(([id, v]) => {
            const def = findMetric(id);
            const history = snapshot.metricHistory?.[id];
            return (
              <li key={id} className="ap-snap__metric">
                <div className="ap-snap__metric-left">
                  <div className="ap-snap__metric-name">{def?.name ?? id}</div>
                  <div className="ap-snap__metric-desc">{def?.description ?? ""}</div>
                  <div className="ap-snap__metric-ver">
                    <span>{def?.version ?? "?"}</span>
                    <span>{def?.source ?? ""}</span>
                  </div>
                </div>
                <div className="ap-snap__metric-right">
                  <div className="ap-snap__metric-value">
                    {formatMetricValue(v, def?.unit ?? "count")}
                  </div>
                  {history != null && (
                    <Sparkline values={history} tone="neutral" width={140} height={28} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="ap-snap__split">
        <div className="ap-snap__col">
          <div className="ap-snap__col-head">Hotspots · {snapshot.hotspots.length}</div>
          <ul className="ap-snap__list">
            {snapshot.hotspots.map((h) => (
              <li key={h.id} className="ap-snap__hot">
                <span className="ap-snap__hot-score">{h.score}</span>
                <div className="ap-snap__hot-body">
                  <div className="ap-snap__hot-kind">{h.kind}</div>
                  <code className="ap-mono ap-snap__hot-path">{h.path}</code>
                  <div className="ap-snap__hot-drivers">
                    {h.drivers.map((d) => (
                      <span key={d} className="ap-snap__hot-driver">{d}</span>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="ap-snap__col">
          <div className="ap-snap__col-head">Violations · {snapshot.violations.length}</div>
          <ul className="ap-snap__list">
            {snapshot.violations.map((v) => (
              <li key={v.id} className={`ap-snap__vio ap-snap__vio--${v.severity}`}>
                <span className="ap-snap__vio-sev">{v.severity}</span>
                <div className="ap-snap__vio-body">
                  <code className="ap-mono ap-snap__vio-path">{v.path}</code>
                  <div className="ap-snap__vio-desc">{v.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ap-snap__ownership">
        <div className="ap-snap__col-head">Ownership · {snapshot.ownership.length} paths</div>
        <ul className="ap-snap__own">
          {snapshot.ownership.map((o) => (
            <li key={o.path} className="ap-snap__own-row">
              <code className="ap-mono ap-snap__own-path">{o.path}</code>
              <Chip tone="muted" mono>{o.team ?? "unassigned"}</Chip>
              <span className="ap-snap__own-who">
                {o.contributors?.slice(0, 3).join(" · ") ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
