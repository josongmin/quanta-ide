import { useTranslation } from "react-i18next";
import { useEditorHover } from "../model/useEditorHover";

function taintKey(raw: string): "ide.symtip.taintSource" | "ide.symtip.taintSink" | "ide.symtip.taintPass" {
  if (raw === "sink") return "ide.symtip.taintSink";
  if (raw === "passthrough") return "ide.symtip.taintPass";
  return "ide.symtip.taintSource";
}

export function SymbolTooltip() {
  const { t } = useTranslation();
  const hovered = useEditorHover((s) => s.hoveredSymbol);
  if (!hovered) return null;

  const { info, x, y } = hovered;
  const TT_WIDTH = 280;
  const TT_GAP = 12;
  const left = Math.min(window.innerWidth - TT_WIDTH - 16, x + TT_GAP);
  const top = y + TT_GAP;

  return (
    <div className="symtip" style={{ left, top, width: TT_WIDTH }}>
      <div className="symtip-head">
        <span className="symtip-kind">{info.kind}</span>
        <span className="symtip-name">{info.name}</span>
      </div>
      <div className="symtip-body">
        {info.taint && (
          <div className="symtip-row">
            <span className="symtip-k">{t("ide.symtip.taint")}</span>
            <span
              className="symtip-v"
              data-tone={info.taint === "source" || info.taint === "sink" ? "warn" : "ink"}
            >
              {t(taintKey(info.taint))}
            </span>
          </div>
        )}
        {info.origin && (
          <div className="symtip-row">
            <span className="symtip-k">{t("ide.symtip.origin")}</span>
            <span className="symtip-v symtip-mono">{info.origin}</span>
          </div>
        )}
        {info.flowsTo && (
          <div className="symtip-row">
            <span className="symtip-k">{t("ide.symtip.flowsTo")}</span>
            <span className="symtip-v symtip-mono">{info.flowsTo}</span>
          </div>
        )}
        {info.callers !== undefined && (
          <div className="symtip-row">
            <span className="symtip-k">{t("ide.symtip.callers")}</span>
            <span className="symtip-v">{info.callers}</span>
          </div>
        )}
        {info.complexity !== undefined && (
          <div className="symtip-row">
            <span className="symtip-k">{t("ide.symtip.complexity")}</span>
            <span className="symtip-v">{info.complexity.toFixed(1)}</span>
          </div>
        )}
        {info.blame && (
          <div className="symtip-row">
            <span className="symtip-k">{t("ide.symtip.blame")}</span>
            <span className="symtip-v">
              {info.blame.author} <span className="symtip-dim">· {info.blame.when}</span>
            </span>
          </div>
        )}
      </div>
      <div className="symtip-foot">
        <span className="symtip-kbd">⌘.</span> {t("ide.symtip.kbdShowFlow")}
        <span className="symtip-kbd">⌘F</span> {t("ide.symtip.kbdFix")}
      </div>
    </div>
  );
}
