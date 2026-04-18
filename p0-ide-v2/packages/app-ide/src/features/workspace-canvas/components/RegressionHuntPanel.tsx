import { useCallback, useEffect, useMemo, useState } from "react";
import { useSceneStore } from "../store/scene-store";
import { interactionStore } from "../store/interaction-store";
import { useFeature } from "../store/feature-flags-store";
import { getAiService } from "../lib/ai-service-ref";
import type { AttributeRegressionResult, RegressionCandidate } from "../lib/ai-service";
import { mockSnapshotIndexForSha } from "../lib/mock-ai-service";

// RegressionHuntPanel (temporal.regressionHunt)
// -----------------------------------------------------------------
// Floating right-edge panel. The user pastes a failing test + log,
// clicks "Hunt", and the AI returns ranked commit candidates.
// Selecting a candidate time-travels the canvas to that commit AND
// highlights the affected files (by driving the selected file to the
// first affected id — MultiFileCanvas already reacts to selection).
//
// Open / close state lives in a tiny window-level signal so the HUD
// command and the command palette can toggle the panel without a
// full store of its own.

const HUNT_OPEN_EVENT = "temporal-hunt-toggle";

export function openRegressionHunt(): void {
  window.dispatchEvent(new CustomEvent(HUNT_OPEN_EVENT, { detail: true }));
}

export function closeRegressionHunt(): void {
  window.dispatchEvent(new CustomEvent(HUNT_OPEN_EVENT, { detail: false }));
}

export function RegressionHuntPanel() {
  const enabled = useFeature("temporal.regressionHunt");
  const graph = useSceneStore(s => s.graph);
  const [open, setOpen] = useState(false);
  const [testName, setTestName] = useState("");
  const [failureLog, setFailureLog] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AttributeRegressionResult | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Listen for the open/close custom event so the palette / HUD can
  // toggle without wiring a dedicated store.
  useEffect(() => {
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setOpen(typeof detail === "boolean" ? detail : v => !v);
    };
    window.addEventListener(HUNT_OPEN_EVENT, onToggle);
    return () => window.removeEventListener(HUNT_OPEN_EVENT, onToggle);
  }, []);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const history = graph?.history;
  const canRun = useMemo(() => {
    if (!graph || !history) return false;
    if (history.snapshots.length < 2) return false;
    return failureLog.trim().length > 0 || testName.trim().length > 0;
  }, [graph, history, failureLog, testName]);

  const onHunt = useCallback(async () => {
    if (!graph || !history || busy) return;
    setBusy(true);
    try {
      const ai = getAiService();
      const out = await ai.attributeRegression({
        testName: testName.trim(),
        failureLog: failureLog.trim(),
        graph,
        history,
      });
      setResult(out);
      setActiveIdx(0);
    } finally {
      setBusy(false);
    }
  }, [graph, history, busy, testName, failureLog]);

  // Jump to the selected candidate: time-travel + highlight files.
  const applyCandidate = useCallback((cand: RegressionCandidate) => {
    if (!history) return;
    const idx = mockSnapshotIndexForSha(history, cand.sha);
    if (idx >= 0) {
      interactionStore.setTemporalMode("live");
      interactionStore.setSnapshotIndex(idx);
    }
    if (result && result.affectedFileIds.length > 0) {
      interactionStore.selectFile(result.affectedFileIds[0]);
    }
  }, [history, result]);

  useEffect(() => {
    if (!result || result.candidateCommits.length === 0) return;
    applyCandidate(result.candidateCommits[activeIdx] ?? result.candidateCommits[0]);
    // only on activeIdx change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  if (!enabled || !open) return null;

  const candidates = result?.candidateCommits ?? [];
  const active = candidates[activeIdx];

  return (
    <div
      role="dialog"
      aria-label="Regression hunt"
      className="ws-hunt-panel"
      style={panelStyle}
    >
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: 12, letterSpacing: 0.3 }}>
          Regression hunt
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={closeBtnStyle}
          title="Close (Esc)"
        >
          ×
        </button>
      </div>

      <div style={bodyStyle}>
        <label style={labelStyle}>
          <span style={labelHeadStyle}>Test name (optional)</span>
          <input
            type="text"
            value={testName}
            onChange={e => setTestName(e.target.value)}
            placeholder="AuthService › rejects expired token"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span style={labelHeadStyle}>Failure log</span>
          <textarea
            value={failureLog}
            onChange={e => setFailureLog(e.target.value)}
            placeholder="Paste stack trace / error message here"
            style={{ ...inputStyle, height: 96, fontFamily: "JetBrains Mono, ui-monospace, monospace", fontSize: 11, resize: "vertical" }}
          />
        </label>

        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button
            type="button"
            onClick={onHunt}
            disabled={!canRun || busy}
            style={{ ...primaryBtnStyle, opacity: !canRun || busy ? 0.55 : 1 }}
          >
            {busy ? "Hunting…" : "Hunt"}
          </button>
          {candidates.length > 1 && (
            <button
              type="button"
              onClick={() => setActiveIdx(i => Math.min(i + 1, candidates.length - 1))}
              disabled={activeIdx >= candidates.length - 1}
              style={ghostBtnStyle}
              title="Advance to next candidate"
            >
              Not this one? Try next
            </button>
          )}
        </div>

        {candidates.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            <div style={sectionLabelStyle}>Candidate commits</div>
            {candidates.map((c, i) => (
              <CandidateRow
                key={c.sha}
                candidate={c}
                active={i === activeIdx}
                onClick={() => setActiveIdx(i)}
              />
            ))}
          </div>
        )}

        {active && result?.affectedFileIds && result.affectedFileIds.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={sectionLabelStyle}>Affected files</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {result.affectedFileIds.slice(0, 12).map(fid => (
                <button
                  key={fid}
                  type="button"
                  onClick={() => interactionStore.selectFile(fid)}
                  style={fileChipStyle}
                  title={fid}
                >
                  {fid.split("/").pop()}
                </button>
              ))}
            </div>
          </div>
        )}

        {result?.narration && (
          <div style={narrationStyle}>{result.narration}</div>
        )}

        {!graph?.history || graph.history.snapshots.length < 2 ? (
          <div style={hintStyle}>No history attached — load a graph with commit history to run the hunt.</div>
        ) : null}
      </div>
    </div>
  );
}

function CandidateRow({
  candidate,
  active,
  onClick,
}: {
  candidate: RegressionCandidate;
  active: boolean;
  onClick: () => void;
}) {
  const pct = Math.round(candidate.confidence * 100);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...candidateRowStyle,
        background: active ? "rgba(56, 189, 248, 0.14)" : "rgba(148, 163, 184, 0.07)",
        borderColor: active ? "rgba(56, 189, 248, 0.55)" : "rgba(148, 163, 184, 0.2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "JetBrains Mono, ui-monospace, monospace", fontSize: 11 }}>
          {candidate.sha.slice(0, 7)}
        </span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>· confidence {pct}%</span>
      </div>
      <div style={confBarWrapStyle}>
        <div style={{ ...confBarFillStyle, width: `${pct}%` }} />
      </div>
      <div style={{ fontSize: 11, opacity: 0.85, textAlign: "left" }}>{candidate.reason}</div>
    </button>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
// Kept inline to avoid bloating workspace-canvas.css; visually matches
// EvidencePanel's slide-in tray aesthetic.

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  bottom: 12,
  width: 360,
  maxWidth: "40vw",
  zIndex: 26,
  display: "flex",
  flexDirection: "column",
  background: "rgba(15, 23, 42, 0.96)",
  color: "#e2e8f0",
  borderRadius: 8,
  boxShadow: "-4px 4px 20px rgba(0, 0, 0, 0.35)",
  fontFamily: "system-ui, sans-serif",
  fontSize: 12,
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
  flex: "0 0 auto",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#94a3b8",
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
  padding: "0 4px",
};

const bodyStyle: React.CSSProperties = {
  padding: "10px 12px",
  overflowY: "auto",
  flex: "1 1 auto",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const labelHeadStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#94a3b8",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(148, 163, 184, 0.08)",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  borderRadius: 4,
  color: "#e2e8f0",
  padding: "6px 8px",
  fontSize: 12,
  outline: "none",
};

const primaryBtnStyle: React.CSSProperties = {
  background: "#38bdf8",
  border: "none",
  color: "#0f172a",
  fontWeight: 600,
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 4,
  cursor: "pointer",
};

const ghostBtnStyle: React.CSSProperties = {
  background: "rgba(148, 163, 184, 0.1)",
  border: "1px solid rgba(148, 163, 184, 0.3)",
  color: "#e2e8f0",
  fontSize: 11,
  padding: "6px 8px",
  borderRadius: 4,
  cursor: "pointer",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#94a3b8",
  marginTop: 4,
};

const candidateRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "8px 10px",
  border: "1px solid transparent",
  borderRadius: 4,
  textAlign: "left",
  cursor: "pointer",
  background: "rgba(148, 163, 184, 0.07)",
  color: "#e2e8f0",
  font: "inherit",
};

const confBarWrapStyle: React.CSSProperties = {
  height: 4,
  background: "rgba(148, 163, 184, 0.2)",
  borderRadius: 2,
  overflow: "hidden",
};

const confBarFillStyle: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, #38bdf8, #818cf8)",
};

const fileChipStyle: React.CSSProperties = {
  background: "rgba(148, 163, 184, 0.1)",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  color: "#e2e8f0",
  fontSize: 11,
  padding: "3px 6px",
  borderRadius: 999,
  cursor: "pointer",
  fontFamily: "JetBrains Mono, ui-monospace, monospace",
};

const narrationStyle: React.CSSProperties = {
  marginTop: 6,
  padding: "8px 10px",
  background: "rgba(56, 189, 248, 0.06)",
  border: "1px solid rgba(56, 189, 248, 0.2)",
  borderRadius: 4,
  lineHeight: 1.5,
  color: "#cbd5e1",
};

const hintStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: "#94a3b8",
  fontStyle: "italic",
};
