import type { SymbolFacts } from "@quanta/app-ide/entities/symbol";

export function StructSection({ info }: { info: SymbolFacts }) {
  const hasImpact = info.blast !== undefined;
  const hasShape = info.callers !== undefined || info.callees !== undefined;
  if (!hasImpact && !hasShape) return null;
  return (
    <div className="symtip__struct">
      {hasImpact && (
        <div className="symtip__struct-row">
          <span className="symtip__struct-label">impact</span>
          <ImpactBar blast={info.blast!} critical={info.blastCritical ?? 0} />
          <span className="symtip__struct-val">
            {info.blast}
            {info.blastCritical ? (
              <span className="symtip__struct-val-sub"> · {info.blastCritical} crit</span>
            ) : null}
          </span>
        </div>
      )}
      {hasShape && (
        <div className="symtip__struct-row">
          <span className="symtip__struct-label">shape</span>
          <ShapeBar callers={info.callers ?? 0} callees={info.callees ?? 0} />
          {info.stability !== undefined && (
            <span className="symtip__struct-val" title="Martin instability · Ce/(Ca+Ce)">
              I {info.stability.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ImpactBar({ blast, critical }: { blast: number; critical: number }) {
  const SCALE = 50;
  const pct = Math.min(100, (blast / SCALE) * 100);
  const critPct = Math.min(pct, (critical / SCALE) * 100);
  return (
    <div className="symtip__impact-bar">
      <div className="symtip__impact-fill" style={{ width: `${pct}%` }} />
      {critical > 0 && (
        <div className="symtip__impact-crit-fill" style={{ width: `${critPct}%` }} />
      )}
    </div>
  );
}

function ShapeBar({ callers, callees }: { callers: number; callees: number }) {
  const max = Math.max(callers, callees, 1);
  const inW = (callers / max) * 100;
  const outW = (callees / max) * 100;
  return (
    <div className="symtip__shape-bar">
      <div className="symtip__shape-side symtip__shape-in">
        <span className="symtip__shape-num">{callers}</span>
        <div
          className="symtip__shape-fill symtip__shape-fill--in"
          style={{ width: `${inW}%` }}
        />
      </div>
      <div className="symtip__shape-core" />
      <div className="symtip__shape-side symtip__shape-out">
        <div
          className="symtip__shape-fill symtip__shape-fill--out"
          style={{ width: `${outW}%` }}
        />
        <span className="symtip__shape-num">{callees}</span>
      </div>
    </div>
  );
}
