import { paybackFactor, paybackQueries, savedTokens, savedUsd } from "./agent-pane.mock";
import { fmt } from "./agent-pane.utils";

export function EnginePaybackCard() {
  return (
    <div className="agst-payback">
      <div className="agst-payback__head">
        <span className="agst-payback__kicker">Engine payback · this session</span>
        <span className="agst-payback__factor">{paybackFactor.toFixed(1)}× vs raw-read</span>
      </div>
      <div className="agst-payback__body">
        <div className="agst-payback__figure">
          <span className="agst-payback__num">{fmt(savedTokens)}</span>
          <span className="agst-payback__unit">tokens saved</span>
          <span className="agst-payback__sep">·</span>
          <span className="agst-payback__cost">${savedUsd.toFixed(2)}</span>
        </div>
        <ul className="agst-payback__list">
          {paybackQueries.map((p) => (
            <li key={p.kind} className="agst-payback__row">
              <span className="agst-payback__row-k">{p.kind}</span>
              <span className="agst-payback__row-n">×{p.count}</span>
              <span className="agst-payback__row-v">{fmt(p.saved)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="agst-payback__foot">
        Engine signals substituted raw file reads and agent guesses — what you would have paid without quanta.
      </div>
    </div>
  );
}
