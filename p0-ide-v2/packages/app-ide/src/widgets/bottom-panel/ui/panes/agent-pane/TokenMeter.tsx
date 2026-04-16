import { costAttribution, forecast, tokens } from "./agent-pane.mock";
import { fmt } from "./agent-pane.utils";
import { LogButton } from "./LogButton";

export function TokenMeter({ onOpenLog }: { onOpenLog: () => void }) {
  const inputPct   = (tokens.inputUsed   / tokens.inputCap)  * 100;
  const cachedPct  = (tokens.inputCached / tokens.inputCap)  * 100;
  const livePct    = inputPct - cachedPct;
  const outPct     = (tokens.outputUsed  / tokens.outputCap) * 100;
  const costPct    = (tokens.cost        / tokens.budget)    * 100;

  return (
    <div className="agst-meter" aria-label="Token usage">
      <div className="agst-meter__head">
        <span className="agst-meter__title">Session meter</span>
        <LogButton label="Session meter" onClick={onOpenLog} />
      </div>
      <MeterRow
        label="input"
        segments={[
          { cls: "agst-meter__fill--cached", width: cachedPct },
          { cls: "agst-meter__fill--used",   width: livePct   },
        ]}
        value={`${fmt(tokens.inputUsed)} / ${fmt(tokens.inputCap)}`}
        sub={`cached ${fmt(tokens.inputCached)} · hit ${Math.round(tokens.cacheHit * 100)}%`}
      />
      <MeterRow
        label="output"
        segments={[{ cls: "agst-meter__fill--used", width: outPct }]}
        value={`${fmt(tokens.outputUsed)} / ${fmt(tokens.outputCap)}`}
      />
      <MeterRow
        label="cost"
        segments={[{ cls: "agst-meter__fill--cost", width: costPct }]}
        value={`$${tokens.cost.toFixed(2)} / $${tokens.budget.toFixed(2)}`}
        sub={`${Math.round(costPct)}% of budget`}
      />

      <div className="agst-meter__forecast">
        <span className="agst-meter__forecast-k">at current burn</span>
        <span className="agst-meter__forecast-v">
          {fmt(forecast.burnPerMin)}/min · cap in {forecast.minutesToCap}m · budget in {forecast.minutesToBudget}m
        </span>
      </div>

      <div className="agst-attr">
        <div className="agst-attr__head">
          <span className="agst-attr__k">by signal</span>
          <span className="agst-attr__total">
            input attribution · {fmt(costAttribution.reduce((a, c) => a + c.tok, 0))} tok
          </span>
        </div>
        <div className="agst-attr__bar" aria-hidden>
          {(() => {
            let left = 0;
            return costAttribution.map((c, i) => {
              const l = left;
              left += c.pct;
              return (
                <span
                  key={i}
                  className="agst-attr__seg"
                  style={{ left: `${l}%`, width: `${c.pct}%`, background: c.color }}
                  title={`${c.signal} · ${c.pct}% · ${fmt(c.tok)} tok`}
                />
              );
            });
          })()}
        </div>
        <div className="agst-attr__legend">
          {costAttribution.map((c) => (
            <span key={c.signal} className="agst-attr__chip">
              <span className="agst-attr__dot" style={{ background: c.color }} aria-hidden />
              <span className="agst-attr__sig">{c.signal}</span>
              <span className="agst-attr__pct">{c.pct}%</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MeterRow({
  label,
  segments,
  value,
  sub,
}: {
  label: string;
  segments: { cls: string; width: number }[];
  value: string;
  sub?: string;
}) {
  let offset = 0;
  return (
    <div className="agst-meter__row">
      <span className="agst-meter__k">{label}</span>
      <div className="agst-meter__bar" aria-hidden>
        {segments.map((s, i) => {
          const left = offset;
          offset += s.width;
          return (
            <span
              key={i}
              className={`agst-meter__fill ${s.cls}`}
              style={{ left: `${left}%`, width: `${s.width}%` }}
            />
          );
        })}
      </div>
      <span className="agst-meter__v">
        {value}
        {sub && <span className="agst-meter__sub"> · {sub}</span>}
      </span>
    </div>
  );
}
