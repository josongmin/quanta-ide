import { useState } from "react";
import { turnSnapshots } from "./agent-pane.mock";
import { fmt } from "./agent-pane.utils";

export function Timescrubber() {
  const [turnIdx, setTurnIdx] = useState(turnSnapshots.length - 1);
  const turn = turnSnapshots[turnIdx];
  const isCurrent = turnIdx === turnSnapshots.length - 1;

  return (
    <div className="tscrub">
      <div className="tscrub__head">
        <span className="tscrub__label">Session timeline</span>
        <span className="tscrub__sub">
          {isCurrent ? "live" : `viewing snapshot · t${turn.turn}`}
        </span>
        {!isCurrent && (
          <button
            type="button"
            className="tscrub__return"
            onClick={() => setTurnIdx(turnSnapshots.length - 1)}
          >
            return to live →
          </button>
        )}
      </div>

      <div className="tscrub__track" role="group" aria-label="Turn scrubber">
        <div className="tscrub__rail" aria-hidden />
        {turnSnapshots.map((s, i) => {
          const leftPct = (i / (turnSnapshots.length - 1)) * 100;
          const isActive = i === turnIdx;
          return (
            <button
              key={s.turn}
              type="button"
              className={`tscrub__marker${isActive ? " is-active" : ""}${i === turnSnapshots.length - 1 ? " is-live" : ""}`}
              style={{ left: `${leftPct}%` }}
              onClick={() => setTurnIdx(i)}
              title={`t${s.turn} · ${s.t} · ${s.label}`}
              aria-label={`Turn ${s.turn}: ${s.label}`}
            >
              <span className="tscrub__marker-dot" aria-hidden />
              <span className="tscrub__marker-label">t{s.turn}</span>
            </button>
          );
        })}
      </div>

      <div className="tscrub__snap">
        <div className="tscrub__snap-head">
          <span className="tscrub__snap-turn">t{turn.turn}</span>
          <span className="tscrub__snap-t">{turn.t}</span>
          <span className="tscrub__snap-label">{turn.label}</span>
        </div>
        <div className="tscrub__snap-stats">
          <SnapStat k="input"  v={fmt(turn.inputTok)} />
          <SnapStat k="output" v={fmt(turn.outputTok)} />
          <SnapStat k="ctx"    v={fmt(turn.contextTok)} />
          <SnapStat k="cost"   v={`$${turn.cost.toFixed(2)}`} />
        </div>
        {turn.events.length > 0 && (
          <div className="tscrub__snap-events">
            {turn.events.map((e, i) => (
              <span key={i} className="tscrub__snap-event">· {e}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SnapStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="tscrub__stat">
      <span className="tscrub__stat-k">{k}</span>
      <span className="tscrub__stat-v">{v}</span>
    </div>
  );
}
