import { useCallback, useEffect, useState } from "react";
import type { GraphHistory } from "@quanta/canvas-engine";
import { useSceneStore } from "../store/scene-store";
import { interactionStore } from "../store/interaction-store";
import { useFeature, featureFlagsStore } from "../store/feature-flags-store";
import { pagesStore } from "../store/pages-store";
import { bookmarksStore } from "../store/bookmarks-store";
import { storyboardStore } from "../store/storyboard-store";
import { viewportStore } from "../store/viewport-store";
import { getAiService } from "../lib/ai-service-ref";
import { mockShaForSnapshot } from "../lib/mock-ai-service";
import type { NarrateCommitResult } from "../lib/ai-service";

// PrReplayLauncher (temporal.prReplay)
// -----------------------------------------------------------------
// Lets the reviewer replay a "PR" (in the mock, a range of commits
// over the existing GraphHistory) one commit at a time. Three entry
// points:
//   1. PR number    — mapped to a deterministic commit slice.
//   2. Range form   — `<base>..<head>` SHAs or snapshot labels.
//   3. Palette      — future integration point.
//
// When nav.pages + nav.bookmarks + nav.storyboard are enabled we
// create a fresh page + bookmark list so the storyboard player
// drives playback. Otherwise we render an inline modal stepper so
// the feature still works standalone.
//
// This component is a button + modal; it mounts unconditionally and
// renders nothing when the feature is off.

const REPLAY_OPEN_EVENT = "temporal-prreplay-toggle";

export function openPrReplay(): void {
  window.dispatchEvent(new CustomEvent(REPLAY_OPEN_EVENT, { detail: true }));
}

export function PrReplayLauncher() {
  const enabled = useFeature("temporal.prReplay");
  const graph = useSceneStore(s => s.graph);
  const [open, setOpen] = useState(false);
  const [prNumber, setPrNumber] = useState("");
  const [rangeText, setRangeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline stepper state (fallback when nav.* is off).
  const [stepper, setStepper] = useState<null | {
    indices: number[];
    cursor: number;
    narrations: (NarrateCommitResult | null)[];
  }>(null);

  useEffect(() => {
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setOpen(typeof detail === "boolean" ? detail : v => !v);
    };
    window.addEventListener(REPLAY_OPEN_EVENT, onEvent);
    return () => window.removeEventListener(REPLAY_OPEN_EVENT, onEvent);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const history = graph?.history;

  // Deterministic PR → snapshot-slice mapping: PR number N selects
  // the last (N % (max-2)+2) commits. Keeps the demo meaningful on
  // short histories without requiring real PR metadata.
  const prToSnapshotRange = useCallback((num: number, h: GraphHistory): [number, number] => {
    const total = h.snapshots.length;
    if (total < 2) return [0, 0];
    const span = Math.max(2, Math.min(total - 1, (num % (total - 1)) + 2));
    const end = total - 1;
    const start = Math.max(1, end - span + 1);
    return [start, end];
  }, []);

  const rangeToSnapshotRange = useCallback((text: string, h: GraphHistory): [number, number] | null => {
    const m = text.match(/^\s*(\S+)\s*\.\.\s*(\S+)\s*$/);
    if (!m) return null;
    const [, aRaw, bRaw] = m;
    const idxFor = (token: string): number => {
      // Match label, commitSha, or shortened mock sha.
      for (let i = 0; i < h.snapshots.length; i++) {
        const snap = h.snapshots[i];
        if (snap.label === token) return i;
        if (snap.commitSha && (snap.commitSha === token || snap.commitSha.startsWith(token))) return i;
        const mockSha = mockShaForSnapshot(h, i);
        if (mockSha && (mockSha === token || mockSha.startsWith(token))) return i;
      }
      return -1;
    };
    const a = idxFor(aRaw);
    const b = idxFor(bRaw);
    if (a < 0 || b < 0) return null;
    return [Math.min(a, b) + 1, Math.max(a, b)]; // exclusive base
  }, []);

  const run = useCallback(async () => {
    if (!graph || !history || busy) return;
    setError(null);
    setBusy(true);
    try {
      let range: [number, number] | null = null;
      const pr = parseInt(prNumber.trim(), 10);
      if (Number.isFinite(pr)) {
        range = prToSnapshotRange(pr, history);
      } else if (rangeText.trim().length > 0) {
        range = rangeToSnapshotRange(rangeText.trim(), history);
      }
      if (!range) {
        setError("Provide a PR number or a range like day-2..day-7");
        return;
      }
      const indices: number[] = [];
      for (let i = range[0]; i <= range[1]; i++) indices.push(i);
      if (indices.length === 0) {
        setError("Range resolved to 0 commits.");
        return;
      }

      // Narrate each commit up front so playback is non-blocking.
      const ai = getAiService();
      const narrations: (NarrateCommitResult | null)[] = [];
      for (const i of indices) {
        const sha = mockShaForSnapshot(history, i);
        if (!sha) {
          narrations.push(null);
          continue;
        }
        const n = await ai.narrateCommit({ sha, graph, history });
        narrations.push(n);
      }

      const canUseNav =
        featureFlagsStore.isEnabled("nav.pages") &&
        featureFlagsStore.isEnabled("nav.bookmarks") &&
        featureFlagsStore.isEnabled("nav.storyboard");

      if (canUseNav) {
        kickOffNavReplay(indices, narrations, prNumber.trim() || rangeText.trim(), history, graph);
        setOpen(false);
      } else {
        setStepper({ indices, cursor: 0, narrations });
        // Time-travel to the first commit immediately.
        interactionStore.setTemporalMode("live");
        interactionStore.setSnapshotIndex(indices[0]);
      }
    } finally {
      setBusy(false);
    }
  }, [graph, history, busy, prNumber, rangeText, prToSnapshotRange, rangeToSnapshotRange]);

  // When the stepper advances, time-travel the canvas.
  useEffect(() => {
    if (!stepper || !history) return;
    const idx = stepper.indices[stepper.cursor];
    if (typeof idx === "number") {
      interactionStore.setSnapshotIndex(idx);
    }
  }, [stepper, history]);

  if (!enabled || !open) return null;

  return (
    <div role="dialog" aria-label="PR replay" style={modalBackdropStyle} onClick={() => setOpen(false)}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>PR replay</span>
          <button type="button" onClick={() => setOpen(false)} style={closeBtnStyle}>×</button>
        </div>

        {!stepper && (
          <div style={modalBodyStyle}>
            <label style={labelStyle}>
              <span style={labelHeadStyle}>PR number</span>
              <input
                type="number"
                value={prNumber}
                onChange={e => setPrNumber(e.target.value)}
                placeholder="42"
                style={inputStyle}
              />
            </label>
            <div style={{ opacity: 0.5, textAlign: "center", fontSize: 11 }}>— or —</div>
            <label style={labelStyle}>
              <span style={labelHeadStyle}>Commit range (base..head)</span>
              <input
                type="text"
                value={rangeText}
                onChange={e => setRangeText(e.target.value)}
                placeholder="day-2..day-7"
                style={inputStyle}
              />
            </label>
            {history && history.snapshots.length >= 2 && (
              <SamplePrHints
                history={history}
                onPick={(pr, range) => { setPrNumber(pr); setRangeText(range); }}
              />
            )}
            {error && <div style={errorStyle}>{error}</div>}
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setOpen(false)} style={ghostBtnStyle}>
                Cancel
              </button>
              <button
                type="button"
                onClick={run}
                disabled={busy || (!prNumber.trim() && !rangeText.trim())}
                style={{ ...primaryBtnStyle, opacity: busy || (!prNumber.trim() && !rangeText.trim()) ? 0.55 : 1 }}
              >
                {busy ? "Preparing…" : "Replay"}
              </button>
            </div>
          </div>
        )}

        {stepper && history && <InlineStepper state={stepper} setState={setStepper} history={history} />}
      </div>
    </div>
  );
}

function kickOffNavReplay(
  indices: readonly number[],
  narrations: readonly (NarrateCommitResult | null)[],
  label: string,
  history: GraphHistory,
  graph: { files: readonly { id: string }[]; fileEdges: readonly { id: string; from: string; to: string }[] },
): void {
  // 1. Create a dedicated page for the replay.
  const pageLabel = `PR replay · ${label || "range"}`;
  const pageId = pagesStore.create(pageLabel, { description: "Auto-generated PR replay" });

  // 2. For each commit, pick a "most-changed file" and capture a bookmark
  // pointing at that file. Camera uses viewportStore's current scale so
  // the replay fits the current zoom rather than snapping to an unknown
  // fit.
  const vp = viewportStore.getState().viewport;
  indices.forEach((snapIndex, i) => {
    const snap = history.snapshots[snapIndex];
    const firstFile = findDominantFileIdForSnapshot(snap, graph) ?? graph.files[0]?.id ?? null;
    const cameraState = { x: vp.x, y: vp.y, scale: vp.scale };
    bookmarksStore.create({
      pageId,
      label: narrations[i]?.summary?.slice(0, 48) ?? snap.label,
      cameraState,
      filterState: { focusFileId: firstFile ?? null },
      order: i,
    });
  });

  // 3. Start storyboard playback from step 0.
  storyboardStore.start(pageId, 0);
  // 4. Time-travel to the first snapshot.
  interactionStore.setTemporalMode("live");
  interactionStore.setSnapshotIndex(indices[0]);
}

function findDominantFileIdForSnapshot(
  snap: { added?: readonly string[]; removed?: readonly string[] } | undefined,
  graph: { fileEdges: readonly { id: string; from: string; to: string }[] },
): string | null {
  if (!snap) return null;
  const edgeIds = [...(snap.added ?? []), ...(snap.removed ?? [])];
  const counts = new Map<string, number>();
  for (const eid of edgeIds) {
    const edge = graph.fileEdges.find(e => e.id === eid);
    if (!edge) continue;
    counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1);
    counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [k, v] of counts) {
    if (v > bestCount) { bestCount = v; best = k; }
  }
  return best;
}

// ── Inline stepper (fallback) ─────────────────────────────────────

function InlineStepper({
  state,
  setState,
  history,
}: {
  state: { indices: number[]; cursor: number; narrations: (NarrateCommitResult | null)[] };
  setState: (s: typeof state | null) => void;
  history: GraphHistory;
}) {
  const curIdx = state.indices[state.cursor];
  const snap = history.snapshots[curIdx];
  const narration = state.narrations[state.cursor];
  const totalSteps = state.indices.length;

  const go = (delta: number) => {
    const next = Math.max(0, Math.min(totalSteps - 1, state.cursor + delta));
    if (next === state.cursor) return;
    setState({ ...state, cursor: next });
  };

  return (
    <div style={modalBodyStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          Step {state.cursor + 1} / {totalSteps}
        </span>
        <div style={{ flex: 1, height: 4, background: "rgba(148,163,184,0.2)", borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              width: `${((state.cursor + 1) / totalSteps) * 100}%`,
              height: "100%",
              background: "#38bdf8",
            }}
          />
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>
        {snap?.message ?? snap?.label}
        {snap?.author && <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 6 }}>· {snap.author}</span>}
      </div>
      {narration && (
        <>
          <div style={{ lineHeight: 1.55, color: "#cbd5e1" }}>{narration.summary}</div>
          {narration.highlights.length > 0 && (
            <ul style={{ paddingLeft: 18, margin: 0, color: "#cbd5e1" }}>
              {narration.highlights.map(h => <li key={h}>{h}</li>)}
            </ul>
          )}
        </>
      )}
      <div style={{ display: "flex", gap: 6, justifyContent: "space-between", marginTop: 6 }}>
        <button type="button" onClick={() => go(-1)} disabled={state.cursor <= 0} style={ghostBtnStyle}>
          ← Prev
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => setState(null)} style={ghostBtnStyle}>
            Close
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={state.cursor >= totalSteps - 1}
            style={primaryBtnStyle}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sample PR hints ───────────────────────────────────────────────
// Surface 3 ready-made PR/range examples derived from the current
// history so users have something meaningful to click. The deterministic
// prToSnapshotRange formula (in-file above) means picking PR numbers
// 7/21/42 gives three distinct, non-trivial slice shapes.

function SamplePrHints({
  history,
  onPick,
}: {
  history: GraphHistory;
  onPick: (pr: string, range: string) => void;
}) {
  const total = history.snapshots.length;
  if (total < 3) return null;
  const samples: { pr: string; range: string; label: string }[] = [];
  const candidates = [7, 21, 42];
  for (const n of candidates) {
    const span = Math.max(2, Math.min(total - 1, (n % (total - 1)) + 2));
    const end = total - 1;
    const start = Math.max(1, end - span + 1);
    const base = history.snapshots[start - 1];
    const head = history.snapshots[end];
    if (!base || !head) continue;
    const baseTok = base.commitSha?.slice(0, 7) ?? base.label;
    const headTok = head.commitSha?.slice(0, 7) ?? head.label;
    samples.push({
      pr: String(n),
      range: `${baseTok}..${headTok}`,
      label: `#${n} · ${span} commits`,
    });
  }
  if (samples.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: -2 }}>
      <span style={{ fontSize: 10, opacity: 0.6, alignSelf: "center" }}>try</span>
      {samples.map(s => (
        <button
          key={s.pr}
          type="button"
          onClick={() => onPick(s.pr, s.range)}
          style={{
            background: "rgba(56, 189, 248, 0.14)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            color: "#7dd3fc",
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 999,
            cursor: "pointer",
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const modalBackdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 30,
};

const modalStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.98)",
  color: "#e2e8f0",
  borderRadius: 8,
  width: 420,
  maxWidth: "80vw",
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45)",
  fontFamily: "system-ui, sans-serif",
  overflow: "hidden",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
};

const modalBodyStyle: React.CSSProperties = {
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  fontSize: 12,
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#94a3b8",
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
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

const errorStyle: React.CSSProperties = {
  color: "#fca5a5",
  fontSize: 11,
  background: "rgba(248, 113, 113, 0.1)",
  padding: "6px 8px",
  borderRadius: 4,
  border: "1px solid rgba(248, 113, 113, 0.3)",
};
