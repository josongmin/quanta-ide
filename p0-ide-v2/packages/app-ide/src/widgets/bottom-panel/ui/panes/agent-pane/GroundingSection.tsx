import { toast } from "@quanta/shell/stores/toast-store";
import { focusStore } from "@quanta/app-ide/stores/focus-store";
import { blindSpots, grounding, signalFreshness } from "./agent-pane.mock";
import { StatTrio } from "./StatTrio";

// ── Topic ② · Grounding section ────────────────────────────────────────
export function GroundingSection() {
  const fresh = signalFreshness.filter((s) => s.state === "fresh").length;
  const aging = signalFreshness.filter((s) => s.state === "aging").length;
  const stale = signalFreshness.filter((s) => s.state === "stale").length;
  const highRisk = blindSpots.filter((b) => b.risk === "high").length;

  return (
    <div className="agst-ground">
      <div className="agst-ground__head">
        <span className="agst-ground__label">Grounding</span>
        <span className="agst-ground__sub">last response · t{grounding.turn}</span>
        <span className="agst-ground__right">
          {grounding.citedCount} cited · {grounding.unbackedCount} unbacked
        </span>
      </div>
      <div className="agst-ground__grid">
        <GroundingScoreCard />
        <BlindSpotCard highRisk={highRisk} />
        <FreshnessCard fresh={fresh} aging={aging} stale={stale} />
      </div>
    </div>
  );
}

function GroundingScoreCard() {
  const scoreColor =
    grounding.score >= 80 ? "var(--success)" :
    grounding.score >= 60 ? "var(--fg)" :
    "var(--danger)";

  return (
    <section className="agst-gcard agst-gcard--score">
      <header className="agst-gcard__h">
        <span className="agst-gcard__label">Score</span>
        <span className="agst-gcard__count">/100</span>
      </header>

      <div className="agst-gscore">
        <span className="agst-gscore__num" style={{ color: scoreColor }}>{grounding.score}</span>
        <div className="agst-gscore__meta">
          <span className="agst-gscore__pill" style={{ color: scoreColor, background: `color-mix(in srgb, ${scoreColor} 12%, transparent)` }}>
            <span className="agst-gscore__dot" style={{ background: scoreColor }} />
            well grounded
          </span>
          <div className="agst-gscore__track" aria-hidden>
            <span className="agst-gscore__fill" style={{ width: `${grounding.score}%`, background: scoreColor }} />
            <span className="agst-gscore__tick" style={{ left: "60%" }} />
            <span className="agst-gscore__tick" style={{ left: "80%" }} />
          </div>
        </div>
      </div>

      <div className="agst-substats agst-substats--3">
        <StatTrio k="Cited"     v={String(grounding.citedCount)} />
        <StatTrio k="Unbacked"  v={String(grounding.unbackedCount)} tone={grounding.unbackedCount > 0 ? "danger" : "default"} />
        <StatTrio k="Sim avg"   v={grounding.similarityAvg.toFixed(2)} />
      </div>

      <ul className="agst-cite">
        {grounding.citations.map((c, i) => (
          <li key={i} className={`agst-cite__row agst-cite__row--${c.state}`}>
            <span className="agst-cite__glyph" aria-hidden>{c.state === "ok" ? "✓" : c.state === "weak" ? "~" : "!"}</span>
            <span className="agst-cite__claim" title={c.claim}>{c.claim}</span>
            <span className="agst-cite__ref" title={c.ref}>{c.ref}</span>
            <span className="agst-cite__engine">{c.engine}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BlindSpotCard({ highRisk }: { highRisk: number }) {
  return (
    <section className="agst-gcard agst-gcard--blind">
      <header className="agst-gcard__h">
        <span className="agst-gcard__label">Blind spots</span>
        <span className="agst-gcard__count">{blindSpots.length}</span>
      </header>

      <div className="agst-substats agst-substats--2">
        <StatTrio k="On path" v={String(blindSpots.length)} />
        <StatTrio k="High risk" v={String(highRisk)} tone={highRisk > 0 ? "warn" : "default"} />
      </div>

      <ul className="agst-blind">
        {blindSpots.map((b) => (
          <li key={b.name} className={`agst-blind__row agst-blind__row--${b.risk}`}>
            <span className="agst-blind__glyph" aria-hidden>ƒ</span>
            <span className="agst-blind__name" title={b.name}>{b.name}</span>
            <span className="agst-blind__layer">{b.layer}</span>
            <span className="agst-blind__why">{b.why}</span>
            <button
              type="button"
              className="agst-blind__inject"
              title="Inject into ⌘E"
              onClick={() => {
                toast.info(
                  `Injected ${b.name} into ⌘E context`,
                  `${b.why} · ${b.layer} layer — agent will have full source on next query`,
                  "context inject",
                );
                focusStore.toggleContextInject(true);
              }}
            >
              inject →
            </button>
          </li>
        ))}
      </ul>

      <p className="agst-gcard__foot">
        patches may not account for behavior in these symbols
      </p>
    </section>
  );
}

function FreshnessCard({ fresh, aging, stale }: { fresh: number; aging: number; stale: number }) {
  const MAX_AGE = 30;
  return (
    <section className="agst-gcard agst-gcard--fresh">
      <header className="agst-gcard__h">
        <span className="agst-gcard__label">Signal freshness</span>
        <span className="agst-gcard__count">{signalFreshness.length}</span>
      </header>

      <div className="agst-substats agst-substats--3">
        <StatTrio k="Fresh"  v={String(fresh)} tone="good" />
        <StatTrio k="Aging"  v={String(aging)} tone="warn" />
        <StatTrio k="Stale"  v={String(stale)} tone={stale > 0 ? "danger" : "default"} />
      </div>

      <ul className="agst-fresh">
        {signalFreshness.map((s) => {
          const pct = Math.min(100, (s.ageMin / MAX_AGE) * 100);
          return (
            <li key={s.signal} className={`agst-fresh__row agst-fresh__row--${s.state}`}>
              <span className="agst-fresh__dot" aria-hidden />
              <span className="agst-fresh__name">{s.signal}</span>
              <div className="agst-fresh__bar" aria-hidden>
                <span className="agst-fresh__fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="agst-fresh__age">{s.age}</span>
              <span className={`agst-fresh__pill agst-fresh__pill--${s.state}`}>{s.state}</span>
            </li>
          );
        })}
      </ul>

      {stale > 0 && (
        <p className="agst-gcard__foot agst-gcard__foot--warn">
          {signalFreshness.find((s) => s.state === "stale")?.note}
        </p>
      )}
    </section>
  );
}
