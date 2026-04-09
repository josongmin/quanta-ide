import { useLiveTyping } from "../model/useLiveTyping";

export function LiveImpactBanner() {
  const { analysisState, blastDelta, taintDelta, isEditing } = useLiveTyping();

  if (!isEditing) return null;

  return (
    <div className="livebanner">
      {analysisState === "analyzing" && (
        <span className="livebanner-status">◐ Impact updating…</span>
      )}
      {analysisState === "done" && (blastDelta > 0 || taintDelta > 0) && (
        <>
          <span className="livebanner-label">Live impact</span>
          {blastDelta > 0 && (
            <span className="livebanner-metric">
              Blast 31 → {31 + blastDelta} <span className="livebanner-delta">(+{blastDelta})</span>
            </span>
          )}
          {taintDelta > 0 && (
            <span className="livebanner-metric">
              Taint 2 → {2 + taintDelta} <span className="livebanner-delta">(+{taintDelta})</span>
            </span>
          )}
        </>
      )}
      {analysisState === "done" && blastDelta === 0 && taintDelta === 0 && (
        <span className="livebanner-status">No impact change</span>
      )}
    </div>
  );
}
