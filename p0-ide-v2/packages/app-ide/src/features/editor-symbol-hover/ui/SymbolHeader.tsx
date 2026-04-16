import type { SymbolFacts } from "@quanta/app-ide/entities/symbol";
import { KIND_GLYPH, KIND_LABEL, riskTone } from "./symbol-popup.utils";

export function SymbolHeader({ info }: { info: SymbolFacts }) {
  return (
    <div className="symtip__head">
      <span className="symtip__glyph">{KIND_GLYPH[info.kind] ?? "?"}</span>
      <span className="symtip__name">{info.name}</span>
      <span className="symtip__kind">{KIND_LABEL[info.kind] ?? info.kind}</span>
      {info.layer && <span className="symtip__layer">{info.layer}</span>}
      <div className="symtip__head-right">
        {info.line > 0 && <span className="symtip__loc">L{info.line}</span>}
        {info.riskScore !== undefined && info.riskScore > 0 && (
          <span className={`symtip__risk ${riskTone(info.riskScore)}`}>
            {info.riskScore}
          </span>
        )}
      </div>
    </div>
  );
}
