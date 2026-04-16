import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { HoverAnchor } from "../model/symbol-hover";
import { computePos } from "./symbol-popup.utils";
import { SymbolHeader } from "./SymbolHeader";
import { FlowPreview } from "./FlowPreview";
import { StructSection } from "./StructSection";
import { MetricsChips } from "./MetricsChips";
import { ChurnStrip, IncidentBadge } from "./ChurnStrip";
import { ContextSection } from "./ContextSection";

interface Props {
  anchor: HoverAnchor;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onOpenFlow?: () => void;
  onJumpLine?: (line: number) => void;
}

export function SymbolPopup({ anchor, onMouseEnter, onMouseLeave, onOpenFlow, onJumpLine }: Props) {
  const { info, rect } = anchor;
  const pos: CSSProperties = useMemo(() => computePos(rect), [rect]);

  const hasContext =
    info.deps !== undefined ||
    info.hotPath !== undefined ||
    info.lastRiskyChange !== undefined ||
    (info.relatedIncidents && info.relatedIncidents.length > 0);

  return (
    <div
      className="symtip"
      style={pos}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <SymbolHeader info={info} />

      {info.contract && (
        <div className="symtip__contract">
          <span className="symtip__contract-verb">{info.contract.verb}</span>
          <span className="symtip__contract-name">{info.contract.name}</span>
        </div>
      )}

      {info.detail && <div className="symtip__detail">{info.detail}</div>}

      {info.why && (
        <div className="symtip__why" title={info.why.href ?? info.why.label}>
          <span className="symtip__why-mark">↳ why</span>
          <span className="symtip__why-label">{info.why.label}</span>
        </div>
      )}

      {info.taint && (
        <div className={`symtip__taint symtip__taint--${info.taint}`}>
          taint · {info.taint}
        </div>
      )}

      {info.flowsTo && info.flowsTo.length > 0 && (
        <FlowPreview flowsTo={info.flowsTo} onOpenFlow={onOpenFlow} onJumpLine={onJumpLine} />
      )}

      <StructSection info={info} />
      <MetricsChips info={info} />

      {info.tags && info.tags.length > 0 && (
        <div className="symtip__tags">
          {info.tags.map((t) => (
            <span key={t} className="symtip__tag">{t}</span>
          ))}
        </div>
      )}

      {info.incidentMatch && <IncidentBadge match={info.incidentMatch} />}
      <ChurnStrip info={info} />
      {hasContext && <ContextSection info={info} />}

      <div className="symtip__foot">
        <span><span className="symtip__kbd">⏎</span>open</span>
        <span><span className="symtip__kbd">⌘↵</span>impact</span>
        <span><span className="symtip__kbd">⌘E</span>ask agent</span>
      </div>
    </div>
  );
}
