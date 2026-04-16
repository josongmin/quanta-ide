/* InsightsView — metric cards + inline charts */
import { cn } from "@/shared/lib";

export function InsightsView() {
  return (
    <div className="pr-page__insights">
      <div className="pr-page__ins-grid">
        <InsCard
          title="Blast Radius"
          hero="23"
          unit="files"
          delta={{ dir: "up", value: "+5", from: "was 18 on main" }}
          sub="transitively affected"
          foot="4 cross-service hops"
          tone="high"
          chart={<BlastChart />}
        />
        <InsCard
          title="Structural Risk"
          hero="0.72"
          delta={{ dir: "up", value: "+0.18", from: "was 0.54 last PR" }}
          sub="engine score · threshold 0.60"
          foot="2 blockers · 5 high"
          tone="crit"
          chart={<RiskChart />}
        />
        <InsCard
          title="Coverage"
          hero="38.6%"
          delta={{ dir: "down", value: "−3.4pp", from: "from 42.0%" }}
          sub="line coverage in payments/*"
          foot="2 new tests · 4 regressions"
          tone="warn"
          chart={<CovChart />}
        />
        <InsCard
          title="Complexity"
          hero="18"
          unit="cyc"
          delta={{ dir: "up", value: "+6", from: "was 12 on main" }}
          sub="retry_handler · budget 15"
          foot="4 files over budget"
          tone="warn"
          chart={<ComplexChart />}
        />
        <InsCard
          title="Test Pass Rate"
          hero="98.1%"
          delta={{ dir: "up", value: "+0.4pp", from: "from 97.7%" }}
          sub="412 / 420 passing"
          foot="+12 new tests · 0 flaky"
          tone="low"
          chart={<TestRateChart />}
        />
        <InsCard
          title="API Latency p99"
          hero="142"
          unit="ms"
          delta={{ dir: "up", value: "+8ms", from: "budget 200ms" }}
          sub="payments/* · 30d window"
          foot="stable · within budget"
          tone="med"
          chart={<LatencyChart />}
        />
      </div>

      <section className="pr-page__ins-sec">
        <header className="pr-page__ins-head">
          <h3>Call graph changes</h3>
          <span className="pr-page__ins-sub">Impact paths tracked by the static engine</span>
        </header>
        <ul className="pr-page__ins-list">
          {[
            { from: "webhook.handle", to: "retry_handler.retry_with_backoff", kind: "modified", hops: 3 },
            { from: "retry_handler.retry_with_backoff", to: "orchestrator.execute", kind: "signature", hops: 1 },
            { from: "orchestrator.execute", to: "ledger.update", kind: "concurrency", hops: 2 },
            { from: "ledger.update", to: "metrics.emit", kind: "new", hops: 1 },
          ].map((e) => (
            <li key={`${e.from}-${e.to}`} className="pr-page__ins-edge">
              <span className={`pr-page__ins-kind pr-page__ins-kind--${e.kind}`}>{e.kind}</span>
              <span className="pr-page__ins-from">{e.from}</span>
              <span className="pr-page__ins-arrow">→</span>
              <span className="pr-page__ins-to">{e.to}</span>
              <span className="pr-page__ins-hops">{e.hops} hop</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="pr-page__ins-sec">
        <header className="pr-page__ins-head">
          <h3>Past incident similarity</h3>
          <span className="pr-page__ins-sub">Prior incidents with overlapping structural patterns</span>
        </header>
        <ul className="pr-page__ins-incidents">
          {[
            { id: "INC-842", title: "ledger double-write on refund retry", sim: 0.89, when: "2025-11" },
            { id: "INC-701", title: "jitterless backoff storm on webhooks", sim: 0.74, when: "2025-08" },
            { id: "INC-655", title: "guard leak in auth rotation", sim: 0.52, when: "2025-06" },
          ].map((i) => (
            <li key={i.id} className="pr-page__ins-inc">
              <span className="pr-page__ins-inc-id">{i.id}</span>
              <span className="pr-page__ins-inc-title">{i.title}</span>
              <span className="pr-page__ins-inc-bar">
                <span style={{ width: `${i.sim * 100}%` }} />
              </span>
              <span className="pr-page__ins-inc-sim">{Math.round(i.sim * 100)}%</span>
              <span className="pr-page__ins-inc-when">{i.when}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="pr-page__ins-sec">
        <header className="pr-page__ins-head">
          <h3>Ownership</h3>
          <span className="pr-page__ins-sub">Owners of modules touched by this change</span>
        </header>
        <div className="pr-page__ins-owners">
          {[
            { team: "Payments Core", owner: "alice", share: 0.62, files: 5 },
            { team: "Shared Infra", owner: "bento", share: 0.23, files: 2 },
            { team: "QA Automation", owner: "claire", share: 0.15, files: 2 },
          ].map((o) => (
            <div key={o.team} className="pr-page__ins-owner">
              <div className="pr-page__ins-owner-top">
                <span className="pr-page__ins-owner-team">{o.team}</span>
                <span className="pr-page__ins-owner-share">{Math.round(o.share * 100)}%</span>
              </div>
              <div className="pr-page__ins-owner-bar">
                <span style={{ width: `${o.share * 100}%` }} />
              </div>
              <div className="pr-page__ins-owner-foot">
                <span>@{o.owner}</span>
                <span>{o.files} files</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type InsTone = "low" | "med" | "high" | "warn" | "crit";
interface InsDelta {
  dir: "up" | "down" | "flat";
  value: string;
  /** secondary baseline reference shown next to the delta */
  from?: string;
}

function InsCard({
  title,
  hero,
  unit,
  delta,
  sub,
  foot,
  tone,
  chart,
}: {
  title: string;
  hero: string;
  unit?: string;
  delta?: InsDelta;
  sub: string;
  foot: string;
  tone: InsTone;
  chart: React.ReactNode;
}) {
  /* Whether a delta is "good" depends on the metric.
     For tone "low" (success) the metric is healthy → up = good.
     For tones high/crit/warn the metric is bad → up = bad.
     Med is neutral. */
  const goodDirection =
    tone === "low" ? "up" : tone === "med" ? null : "down";
  const isGood = delta && goodDirection && delta.dir === goodDirection;
  const isBad = delta && goodDirection && delta.dir !== goodDirection && delta.dir !== "flat";

  return (
    <article className={`pr-page__ins-card pr-page__ins-card--${tone}`}>
      <header className="pr-page__ins-card-head">{title}</header>
      <div className="pr-page__ins-card-row">
        <div className="pr-page__ins-card-hero">
          {hero}
          {unit && <span className="pr-page__ins-card-unit">{unit}</span>}
        </div>
        {delta && (
          <span
            className={cn("pr-page__ins-card-delta", isGood && "is-good", isBad && "is-bad")}
          >
            <DeltaArrow dir={delta.dir} />
            {delta.value}
          </span>
        )}
      </div>
      <div className="pr-page__ins-card-sub">
        {sub}
        {delta?.from && <span className="pr-page__ins-card-from"> · {delta.from}</span>}
      </div>
      <div className="pr-page__ins-card-chart">{chart}</div>
      <footer className="pr-page__ins-card-foot">{foot}</footer>
    </article>
  );
}

function DeltaArrow({ dir }: { dir: InsDelta["dir"] }) {
  if (dir === "up") {
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 8l3-4 3 4" />
      </svg>
    );
  }
  if (dir === "down") {
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 4l3 4 3-4" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h6" />
    </svg>
  );
}

/* All charts use a wide viewBox (240×40) that roughly matches the rendered
   container aspect, so circles/dots stay round instead of getting stretched. */
function BlastChart() {
  // 4 columns of nodes spreading out (root → tier 1 → tier 2 → tier 3)
  const cols = [24, 88, 152, 216];
  const tier1 = [12, 22, 30];
  const tier2 = [6, 14, 22, 28, 34];
  const tier3 = [8, 18, 26, 32];
  const lines: [number, number, number, number][] = [];
  // root → tier1
  for (const y of tier1) lines.push([cols[0], 20, cols[1], y]);
  // tier1 → tier2 (each tier1 node connects to ~2 tier2 nodes)
  for (let i = 0; i < tier1.length; i++) {
    lines.push([cols[1], tier1[i], cols[2], tier2[i]]);
    lines.push([cols[1], tier1[i], cols[2], tier2[i + 1]]);
  }
  // tier2 → tier3
  for (let i = 0; i < tier2.length; i++) {
    if (tier3[i] !== undefined) lines.push([cols[2], tier2[i], cols[3], tier3[i]]);
  }
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="xMidYMid meet">
      {lines.map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="0.9"
        />
      ))}
      <circle cx={cols[0]} cy={20} r="3.4" fill="currentColor" />
      {tier1.map((y, i) => <circle key={`a${i}`} cx={cols[1]} cy={y} r="1.8" fill="currentColor" />)}
      {tier2.map((y, i) => <circle key={`b${i}`} cx={cols[2]} cy={y} r="1.8" fill="currentColor" />)}
      {tier3.map((y, i) => <circle key={`c${i}`} cx={cols[3]} cy={y} r="1.8" fill="currentColor" />)}
    </svg>
  );
}
function RiskChart() {
  const pts = [0.12, 0.18, 0.22, 0.19, 0.28, 0.34, 0.4, 0.46, 0.54, 0.58, 0.68, 0.72];
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * 240) / (pts.length - 1)} ${40 - p * 40}`)
    .join(" ");
  // threshold line at 0.60 (engine "blocker" cutoff)
  const thresholdY = 40 - 0.6 * 40;
  const lastX = 240;
  const lastY = 40 - pts[pts.length - 1] * 40;
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="none">
      <path d={`${d} L 240 40 L 0 40 Z`} fill="currentColor" fillOpacity="0.15" />
      <line
        x1="0"
        y1={thresholdY}
        x2="240"
        y2={thresholdY}
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="0.7"
        strokeDasharray="2 2"
      />
      <path d={d} stroke="currentColor" fill="none" strokeWidth="1.4" />
      <circle cx={lastX} cy={lastY} r="2.4" fill="currentColor" />
    </svg>
  );
}
function CovChart() {
  const heights = [24, 28, 26, 30, 28, 32, 30, 28, 22, 20, 18, 16];
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="none">
      {heights.map((h, i) => (
        <rect key={i} x={i * 20 + 4} y={40 - h} width="14" height={h} fill="currentColor" fillOpacity="0.7" />
      ))}
    </svg>
  );
}
function ComplexChart() {
  // y values are inverse of complexity score (higher complexity = lower y)
  const pts = [32, 30, 28, 22, 18, 14, 10];
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * 240) / (pts.length - 1)} ${p}`)
    .join(" ");
  // budget line at cyclomatic 15 (≈ y 17 in the inverted coord)
  const budgetY = 17;
  const lastX = ((pts.length - 1) * 240) / (pts.length - 1);
  const lastY = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="xMidYMid meet">
      <line
        x1="0"
        y1={budgetY}
        x2="240"
        y2={budgetY}
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="0.7"
        strokeDasharray="2 2"
      />
      <path d={d} stroke="currentColor" fill="none" strokeWidth="1.4" />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={(i * 240) / (pts.length - 1)}
          cy={p}
          r={i === pts.length - 1 ? 2.4 : 1.6}
          fill="currentColor"
        />
      ))}
      <circle cx={lastX} cy={lastY} r="4" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
    </svg>
  );
}
function TestRateChart() {
  // mostly-passing bars with two dips (the failing builds)
  const heights = [26, 28, 27, 29, 28, 30, 14, 29, 28, 27, 29, 17];
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="none">
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 20 + 4}
          y={40 - h}
          width="14"
          height={h}
          fill="currentColor"
          fillOpacity={h < 20 ? 0.35 : 0.7}
        />
      ))}
    </svg>
  );
}
function LatencyChart() {
  const pts = [22, 20, 24, 22, 26, 23, 21, 25, 24, 22, 26, 24];
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * 240) / (pts.length - 1)} ${40 - p}`)
    .join(" ");
  // budget line near the top of the chart (200ms budget)
  const budgetY = 6;
  const lastX = 240;
  const lastY = 40 - pts[pts.length - 1];
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="xMidYMid meet">
      <line
        x1="0"
        y1={budgetY}
        x2="240"
        y2={budgetY}
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="0.7"
        strokeDasharray="2 2"
      />
      <path d={`${d} L 240 40 L 0 40 Z`} fill="currentColor" fillOpacity="0.12" />
      <path d={d} stroke="currentColor" fill="none" strokeWidth="1.4" />
      <circle cx={lastX} cy={lastY} r="2.4" fill="currentColor" />
    </svg>
  );
}
