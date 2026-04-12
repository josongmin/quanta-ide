/* =============================================================================
   SymbolTooltip.tsx — registry 기반 심볼 팝오버
   새 kind 추가 = renderers/registry.ts 에만 등록
   ============================================================================= */
import { Tooltip } from "@/shared/ui";
import { useEditorHover } from "../model/useEditorHover";
import { SYMBOL_REGISTRY } from "../renderers/registry";
import { riskColor } from "./sections/helpers";

export { LineTooltip } from "./LineTooltip";

export function SymbolTooltip() {
  const hovered = useEditorHover((s) => s.hoveredSymbol);
  if (!hovered) return null;

  const { info, x, y } = hovered;
  const TT_WIDTH = 300;
  const ESTIMATED_H = 280;
  const renderer = SYMBOL_REGISTRY[info.kind];

  return (
    <Tooltip x={x} y={y} width={TT_WIDTH} estimatedHeight={ESTIMATED_H} className="symtip">

      {/* ── Header ── */}
      <div className="symtip-head">
        <span className="symtip-kind-glyph">{renderer.icon}</span>
        <span className="symtip-name">{info.name}</span>
        <span className="symtip-kind-label">{renderer.label}</span>
        {info.riskScore !== undefined && info.riskScore > 0 && (
          <span className="symtip-risk-badge" style={{
            color: riskColor(info.riskScore),
            borderColor: riskColor(info.riskScore),
          }}>
            {info.riskScore}
          </span>
        )}
      </div>

      {/* ── Sections (registry-driven) ── */}
      {renderer.sections.map((Section, i) => (
        <Section key={i} info={info} />
      ))}

      {/* ── Footer ── */}
      {(() => {
        const hints = renderer.footerHints(info);
        if (!hints.length) return null;
        return (
          <div className="symtip-foot">
            {hints.map(({ kbd, label }) => (
              <span key={kbd} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span className="symtip-kbd">{kbd}</span>{label}
              </span>
            ))}
          </div>
        );
      })()}
    </Tooltip>
  );
}
