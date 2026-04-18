import { DemoAppHero } from "../../internal/DemoAppHero";
import { Sparkline } from "../../internal/Sparkline";
import { StatCard } from "../../internal/StatCard";

function bars(n: number, seed: number) {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    out.push(0.35 + (s / 233280) * 0.65);
  }
  return out;
}

type Severity = "ok" | "warn" | "danger";

function severityFor(pct: number): Severity {
  if (pct >= 90) return "danger";
  if (pct >= 75) return "warn";
  return "ok";
}

interface QuotaItem {
  label: string;
  used: number;
  total: number;
  unit: string;
  pct: number;
}

function QuotaList({ items }: { items: QuotaItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((it, i) => {
        const sev = severityFor(it.pct);
        const fill =
          sev === "danger" ? "var(--danger)" :
          sev === "warn"   ? "var(--warn)" :
          "var(--fg)";
        const pctColor =
          sev === "danger" ? "var(--danger)" :
          sev === "warn"   ? "var(--warn)" :
          "var(--fg-subtle)";

        return (
          <div
            key={it.label}
            style={{
              display: "grid",
              gridTemplateColumns: "180px minmax(0,1fr) 140px",
              gap: 16,
              alignItems: "center",
              padding: "12px 0",
              borderTop: i === 0 ? "none" : "1px dashed var(--border)",
              fontSize: "var(--fs-xs)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>{it.label}</span>
              {sev !== "ok" && (
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: fill,
                  }}
                />
              )}
            </div>
            <div
              style={{
                position: "relative",
                height: 4,
                background: "var(--bg-muted)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${it.pct}%`,
                  background: fill,
                  borderRadius: 999,
                  transition: "width 0.2s ease, background 0.2s ease",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "flex-end",
                gap: 8,
                fontFamily: "var(--font-mono)",
              }}
            >
              <span style={{ color: pctColor, fontWeight: "var(--fw-semibold)" }}>
                {it.pct}%
              </span>
              <span style={{ color: "var(--fg-subtle)", fontSize: "var(--fs-10)" }}>
                {it.used}{it.unit} / {it.total}{it.unit}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function UsagePage() {
  const tokens = bars(14, 42);
  const minutes = bars(14, 99);
  const seats = bars(14, 7);

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Admin"
        title="Usage dashboard"
        sub="Last 14 days across your workspace. Resets on the 1st of each month."
      />
      <div className="demo-app__body">
        <div className="demo-grid-3" style={{ marginBottom: 16 }}>
          <StatCard
            label="AI tokens"
            value="1.42M"
            delta="+18% vs last period"
            deltaTone="up"
            chart={<Sparkline values={tokens} color="var(--accent-purple)" />}
          />
          <StatCard
            label="Analysis minutes"
            value="8,204"
            delta="+4% vs last period"
            deltaTone="up"
            chart={<Sparkline values={minutes} color="var(--accent)" />}
          />
          <StatCard
            label="Active seats"
            value="12 / 25"
            delta="-1 vs last period"
            deltaTone="down"
            chart={<Sparkline values={seats} />}
          />
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Quota</div>
              <div className="demo-block__sub">Soft caps — overage is billed at the on-demand rate.</div>
            </div>
          </header>
          <div className="demo-block__body">
            <QuotaList
              items={[
                { label: "AI tokens",          used: 1.42, total: 2,  unit: "M", pct: 71 },
                { label: "Analysis minutes",   used: 8.2,  total: 20, unit: "k", pct: 41 },
                { label: "Seats",              used: 12,   total: 25, unit: "",  pct: 48 },
                { label: "Webhook deliveries", used: 46.7, total: 50, unit: "k", pct: 93 },
              ]}
            />
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Heaviest users</div>
              <div className="demo-block__sub">By AI tokens consumed this period.</div>
            </div>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="is-num" style={{ textAlign: "right" }}>Tokens</th>
                  <th className="is-num" style={{ textAlign: "right" }}>Minutes</th>
                  <th className="is-num" style={{ textAlign: "right" }}>Runs</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Ada Lovelace",      t: "412k", m: "1,834", r: "126" },
                  { name: "Alan Turing",       t: "301k", m: "1,212", r: "89" },
                  { name: "Grace Hopper",      t: "244k", m: "992",   r: "71" },
                  { name: "Linus Torvalds",    t: "198k", m: "842",   r: "58" },
                  { name: "Donald Knuth",      t: "143k", m: "601",   r: "41" },
                ].map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className="is-num">{r.t}</td>
                    <td className="is-num">{r.m}</td>
                    <td className="is-num">{r.r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
