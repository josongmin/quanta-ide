import { useState } from "react";
import { TODAY, MONTH, RANGES, type Range } from "@/entities/watcher";
import { CalendarIcon, ChevronDownTiny } from "../../lib/icons";
import { eventLabel, bucketTime } from "../../lib/helpers";

export function WatcherPane() {
  const [range, setRange] = useState<Range>("30d");

  const todayTurnsMax = Math.max(...TODAY.map((b) => b.turns));
  const todayLocMax   = Math.max(...TODAY.flatMap((b) => [b.locAdd, b.locDel]));
  const monthTurnsMax = Math.max(...MONTH.map((b) => b.turns));
  const monthLocMax   = Math.max(...MONTH.map((b) => Math.abs(b.netLoc)));

  return (
    <div className="pane pane--watcher">
      <div className="toolbar">
        <button
          type="button"
          className="wt-pill"
          aria-label="Time range"
          title="Time range"
          onClick={() => {
            const i = RANGES.indexOf(range);
            setRange(RANGES[(i + 1) % RANGES.length]);
          }}
        >
          <span>{range}</span>
          <ChevronDownTiny />
        </button>
        <button type="button" className="wt-pill" aria-label="Pick end date" title="End date">
          <CalendarIcon />
          <span>Apr 14</span>
          <ChevronDownTiny />
        </button>
        <button type="button" className="wt-pill" aria-label="Filter by agent" title="Agent filter">
          <span className="wt-filter-dot" aria-hidden /> all agents
          <ChevronDownTiny />
        </button>
        <div className="toolbar__spacer" />
        <span className="toolbar__muted">
          session <b className="wt-mono">3h 12m</b> · claude 4.6 · accept rate <b className="wt-mono">84%</b>
        </span>
      </div>

      <div className="wt-grid">
        {/* ── Section 1: Today (hourly detail) ────────────────────── */}
        <section className="wt-section wt-section--today" aria-label="Today — LLM activity by 30-minute bucket">
          <header className="wt-head">
            <div className="wt-title">
              <span className="wt-kicker">Today</span>
              <span className="wt-sub">12:00 – 20:00 · 30m buckets</span>
            </div>
            <div className="wt-head-stat">
              <span className="wt-hn">+126</span>
              <span className="wt-hl">net LOC</span>
            </div>
          </header>

          <div className="wt-row">
            <span className="wt-row-label">turns</span>
            <div className="wt-bars wt-bars--solid">
              {TODAY.map((b, i) => (
                <div key={i} className="wt-cell" title={`${bucketTime(i)} · ${b.turns} turns`}>
                  <div className="wt-bar wt-bar--turns" style={{ height: `${(b.turns / todayTurnsMax) * 100}%` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="wt-row">
            <span className="wt-row-label">Δ LOC</span>
            <div className="wt-bars wt-bars--div">
              <span className="wt-baseline" aria-hidden />
              {TODAY.map((b, i) => (
                <div key={i} className="wt-cell wt-cell--div" title={`${bucketTime(i)} · +${b.locAdd} / −${b.locDel}`}>
                  <div className="wt-half wt-half--top">
                    <div className="wt-bar wt-bar--pos" style={{ height: `${(b.locAdd / todayLocMax) * 100}%` }} />
                  </div>
                  <div className="wt-half wt-half--bot">
                    <div className="wt-bar wt-bar--neg" style={{ height: `${(b.locDel / todayLocMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="wt-row">
            <span className="wt-row-label">events</span>
            <div className="wt-events">
              {TODAY.map((b, i) => (
                <div key={i} className="wt-evt-cell" title={b.events.length ? `${bucketTime(i)} · ${b.events.map(eventLabel).join(", ")}` : bucketTime(i)}>
                  {b.events.map((e, j) => (
                    <span key={j} className={`wt-evt wt-evt--${e}`} aria-label={eventLabel(e)} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="wt-axis">
            <span>12:00</span><span>16:00</span><span>20:00</span>
          </div>
        </section>

        {/* ── Section 2: Last 30 days (daily overview) ────────────── */}
        <section className="wt-section wt-section--month" aria-label="Last 30 days — LLM activity by day">
          <header className="wt-head">
            <div className="wt-title">
              <span className="wt-kicker">30 days</span>
              <span className="wt-sub">turns · net Δ LOC per day</span>
            </div>
            <div className="wt-head-stat">
              <span className="wt-hn">−264</span>
              <span className="wt-hl">30d net LOC</span>
            </div>
          </header>

          <div className="wt-row">
            <span className="wt-row-label">turns</span>
            <div className="wt-bars wt-bars--solid">
              {MONTH.map((b, i) => (
                <div key={i} className="wt-cell" title={`day ${i + 1} · ${b.turns} turns`}>
                  <div className="wt-bar wt-bar--turns" style={{ height: `${(b.turns / monthTurnsMax) * 100}%` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="wt-row">
            <span className="wt-row-label">Δ LOC</span>
            <div className="wt-bars wt-bars--div">
              <span className="wt-baseline" aria-hidden />
              {MONTH.map((b, i) => {
                const h = (Math.abs(b.netLoc) / monthLocMax) * 100;
                return (
                  <div key={i} className="wt-cell wt-cell--div" title={`day ${i + 1} · ${b.netLoc >= 0 ? "+" : ""}${b.netLoc} LOC`}>
                    <div className="wt-half wt-half--top">
                      {b.netLoc >= 0 && <div className="wt-bar wt-bar--pos" style={{ height: `${h}%` }} />}
                    </div>
                    <div className="wt-half wt-half--bot">
                      {b.netLoc < 0 && <div className="wt-bar wt-bar--neg" style={{ height: `${h}%` }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wt-axis">
            <span>3/14</span><span>30d</span><span>4/12</span>
          </div>
        </section>
      </div>
    </div>
  );
}
