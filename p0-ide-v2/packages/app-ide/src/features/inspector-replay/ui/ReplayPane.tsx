import "./replay-pane.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getReplay,
  type EventKind,
  type IncidentDnaSample,
  type ReplayEvent,
  type VariableSnapshot,
} from "@quanta/app-ide/entities/incident-replay";

/* ─── Per-kind style map (design tokens) ────────────────────── */

const KIND_COLOR: Record<EventKind, string> = {
  enter:     "var(--accent)",
  exit:      "var(--fg-subtle)",
  log:       "var(--fg-muted)",
  read:      "var(--fg-muted)",
  write:     "var(--warn, #d08700)",
  await:     "color-mix(in srgb, var(--accent) 60%, var(--fg-muted))",
  resume:    "color-mix(in srgb, var(--accent) 35%, var(--fg-muted))",
  branch:    "color-mix(in srgb, var(--accent) 70%, var(--warn, #d08700))",
  exception: "var(--danger)",
};

const KIND_CHAR: Record<EventKind, string> = {
  enter:     "→",
  exit:      "←",
  log:       "·",
  read:      "r",
  write:     "W",
  await:     "⏳",
  resume:    "▶",
  branch:    "⎇",
  exception: "!",
};

const KIND_BG: Record<EventKind, string> = {
  enter:     "color-mix(in srgb, var(--accent) 70%, var(--fg))",
  exit:      "var(--fg-subtle)",
  log:       "var(--fg-muted)",
  read:      "var(--fg-muted)",
  write:     "var(--warn, #d08700)",
  await:     "color-mix(in srgb, var(--accent) 55%, var(--fg-subtle))",
  resume:    "color-mix(in srgb, var(--accent) 35%, var(--fg-subtle))",
  branch:    "color-mix(in srgb, var(--accent) 60%, var(--warn, #d08700))",
  exception: "var(--danger)",
};

/* ─── Pure helpers ───────────────────────────────────────────── */

/** Reconstruct the active call stack up to (and including) event index `idx`. */
function reconstructStack(events: ReplayEvent[], idx: number): ReplayEvent[] {
  const stack: ReplayEvent[] = [];
  for (let i = 0; i <= idx && i < events.length; i++) {
    const e = events[i];
    if (e.kind === "enter") {
      stack.push(e);
    } else if (e.kind === "exit") {
      // pop deepest matching frame (by name), else pop top
      let popIdx = -1;
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].frame === e.frame) { popIdx = k; break; }
      }
      if (popIdx >= 0) {
        stack.splice(popIdx, 1);
      } else if (stack.length > 0) {
        stack.pop();
      }
    }
  }
  return stack;
}

/** Find index of last event with t <= playhead. */
function findEventIndexAt(events: ReplayEvent[], t: number): number {
  if (events.length === 0) return -1;
  let lo = 0;
  let hi = events.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].t <= t) { best = mid; lo = mid + 1; }
    else { hi = mid - 1; }
  }
  return best;
}

/** Build a smoothed area path for a DNA lane (values 0-100). */
function buildLanePath(samples: IncidentDnaSample[], pick: (s: IncidentDnaSample) => number, w: number, h: number, totalMs: number): string {
  if (samples.length === 0 || totalMs <= 0) return "";
  const xs = samples.map((s) => (s.t / totalMs) * w);
  const ys = samples.map((s) => h - (Math.max(0, Math.min(100, pick(s))) / 100) * h);
  let d = `M 0 ${h.toFixed(2)} `;
  d += `L ${xs[0].toFixed(2)} ${ys[0].toFixed(2)} `;
  for (let i = 1; i < xs.length; i++) {
    d += `L ${xs[i].toFixed(2)} ${ys[i].toFixed(2)} `;
  }
  d += `L ${w.toFixed(2)} ${h.toFixed(2)} Z`;
  return d;
}

/** Closest snapshot with t <= playhead, else the earliest snapshot. */
function pickSnapshot(snapshots: VariableSnapshot[], t: number): VariableSnapshot | null {
  if (snapshots.length === 0) return null;
  let best: VariableSnapshot | null = null;
  for (const s of snapshots) {
    if (s.t <= t) {
      if (!best || s.t > best.t) best = s;
    }
  }
  return best ?? snapshots[0];
}

/* ─── Component ──────────────────────────────────────────────── */

export function ReplayPane({ file }: { file: FileFacts }) {
  const replay = useMemo(() => getReplay(file.name), [file.name]);

  // Default playhead = failure time (exception event), else last event, else 0.
  const initialT = useMemo(() => {
    if (!replay) return 0;
    const exc = replay.events.find((e) => e.kind === "exception");
    if (exc) return exc.t;
    const last = replay.events[replay.events.length - 1];
    return last ? last.t : 0;
  }, [replay]);

  const [playheadT, setPlayheadT] = useState<number>(initialT);

  // Reset playhead when file (and thus replay) changes.
  useEffect(() => {
    setPlayheadT(initialT);
  }, [initialT]);

  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const logRef = useRef<HTMLUListElement | null>(null);
  const activeRowRef = useRef<HTMLLIElement | null>(null);
  const draggingRef = useRef<boolean>(false);

  const totalMs = replay?.durationMs ?? 0;

  const currentIdx = useMemo(() => {
    if (!replay) return -1;
    return findEventIndexAt(replay.events, playheadT);
  }, [replay, playheadT]);

  const currentEvent: ReplayEvent | null = useMemo(() => {
    if (!replay || currentIdx < 0) return null;
    return replay.events[currentIdx];
  }, [replay, currentIdx]);

  const stack = useMemo(() => {
    if (!replay || currentIdx < 0) return [];
    return reconstructStack(replay.events, currentIdx);
  }, [replay, currentIdx]);

  const snapshot = useMemo(() => {
    if (!replay) return null;
    return pickSnapshot(replay.snapshots, playheadT);
  }, [replay, playheadT]);

  /* ── Scrubber interactions ── */

  const setTFromClientX = useCallback((clientX: number) => {
    const el = scrubberRef.current;
    if (!el || totalMs <= 0) return;
    const r = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    setPlayheadT(Math.round(ratio * totalMs));
  }, [totalMs]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (totalMs <= 0) return;
    draggingRef.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setTFromClientX(e.clientX);
    e.currentTarget.focus();
  }, [setTFromClientX, totalMs]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setTFromClientX(e.clientX);
  }, [setTFromClientX]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    const el = e.currentTarget as HTMLDivElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!replay) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = currentIdx > 0 ? replay.events[currentIdx - 1] : replay.events[0];
      if (prev) setPlayheadT(prev.t);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const next =
        currentIdx >= 0 && currentIdx < replay.events.length - 1
          ? replay.events[currentIdx + 1]
          : replay.events[replay.events.length - 1];
      if (next) setPlayheadT(next.t);
    } else if (e.key === "Home") {
      e.preventDefault();
      setPlayheadT(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setPlayheadT(totalMs);
    }
  }, [replay, currentIdx, totalMs]);

  const jumpToEvent = useCallback((ev: ReplayEvent) => {
    setPlayheadT(ev.t);
  }, []);

  // Auto-scroll active event into view.
  useEffect(() => {
    const el = activeRowRef.current;
    const listEl = logRef.current;
    if (!el || !listEl) return;
    const er = el.getBoundingClientRect();
    const lr = listEl.getBoundingClientRect();
    if (er.top < lr.top || er.bottom > lr.bottom) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentIdx]);

  /* ── Counterfactual rewind ── */

  const counterfactualEvent = currentEvent && currentEvent.counterfactual ? currentEvent : null;
  const rewindToBranch = useCallback(() => {
    if (!replay || !counterfactualEvent) return;
    // Nearest preceding (or same) branch event; fall back to the event itself.
    let target: ReplayEvent | null = null;
    for (let i = replay.events.indexOf(counterfactualEvent); i >= 0; i--) {
      if (replay.events[i].kind === "branch") { target = replay.events[i]; break; }
    }
    setPlayheadT((target ?? counterfactualEvent).t);
  }, [replay, counterfactualEvent]);

  /* ── Early empty state ── */

  if (!replay) {
    return (
      <div className="replay-pane">
        <div className="replay-pane__empty">
          <div>No incident replay available for this file.</div>
          <div className="replay-pane__empty-sub">
            Replays are captured from production incidents; open an affected file to scrub.
          </div>
        </div>
      </div>
    );
  }

  /* ── Layout geometry for DNA SVGs (viewBox normalized) ── */

  const dnaW = 400;
  const dnaH = 12;
  const pathCpu = buildLanePath(replay.dna, (s) => s.cpu, dnaW, dnaH, totalMs);
  const pathMem = buildLanePath(replay.dna, (s) => s.mem, dnaW, dnaH, totalMs);
  const pathIo  = buildLanePath(replay.dna, (s) => s.io,  dnaW, dnaH, totalMs);
  const playheadX = totalMs > 0 ? (playheadT / totalMs) * dnaW : 0;
  const playheadPct = totalMs > 0 ? (playheadT / totalMs) * 100 : 0;

  const capturedDate = (() => {
    try { return new Date(replay.capturedAt).toISOString().slice(0, 16).replace("T", " "); }
    catch { return replay.capturedAt; }
  })();

  return (
    <div className="replay-pane">
      {/* Header */}
      <div className="replay-pane__header">
        <div className="replay-pane__title">{replay.title}</div>
        <div className="replay-pane__meta">
          <span>{capturedDate}</span>
          <span className="replay-pane__sep">·</span>
          <span>{replay.durationMs}ms</span>
          <span className="replay-pane__sep">·</span>
          <span>{replay.events.length} events</span>
        </div>
        {replay.rootCauseFrame ? (
          <span className="replay-pane__rootcause" title="root cause frame">
            root cause: {replay.rootCauseFrame}
          </span>
        ) : null}
      </div>

      {/* DNA ribbon */}
      <div className="replay-pane__dna" aria-label="Incident DNA (CPU/MEM/IO)">
        <div className="replay-pane__dna-label">CPU</div>
        <div className="replay-pane__dna-lane">
          <svg className="replay-pane__dna-svg" viewBox={`0 0 ${dnaW} ${dnaH}`} preserveAspectRatio="none">
            <path className="replay-pane__dna-path--cpu" d={pathCpu} strokeWidth={1} />
            <line className="replay-pane__dna-playhead" x1={playheadX} y1={0} x2={playheadX} y2={dnaH} />
          </svg>
        </div>
        <div className="replay-pane__dna-label">MEM</div>
        <div className="replay-pane__dna-lane">
          <svg className="replay-pane__dna-svg" viewBox={`0 0 ${dnaW} ${dnaH}`} preserveAspectRatio="none">
            <path className="replay-pane__dna-path--mem" d={pathMem} strokeWidth={1} />
            <line className="replay-pane__dna-playhead" x1={playheadX} y1={0} x2={playheadX} y2={dnaH} />
          </svg>
        </div>
        <div className="replay-pane__dna-label">IO</div>
        <div className="replay-pane__dna-lane">
          <svg className="replay-pane__dna-svg" viewBox={`0 0 ${dnaW} ${dnaH}`} preserveAspectRatio="none">
            <path className="replay-pane__dna-path--io" d={pathIo} strokeWidth={1} />
            <line className="replay-pane__dna-playhead" x1={playheadX} y1={0} x2={playheadX} y2={dnaH} />
          </svg>
        </div>
      </div>

      {/* Scrubber */}
      <div
        ref={scrubberRef}
        className="replay-pane__scrubber"
        tabIndex={0}
        role="slider"
        aria-label="Incident timeline scrubber"
        aria-valuemin={0}
        aria-valuemax={totalMs}
        aria-valuenow={playheadT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <div className="replay-pane__scrubber-track" />
        {replay.events.map((ev) => (
          <span
            key={ev.id}
            className="replay-pane__scrubber-tick"
            style={{
              left: `${(ev.t / totalMs) * 100}%`,
              background: KIND_COLOR[ev.kind],
            }}
            title={`${ev.t}ms · ${ev.kind} · ${ev.frame}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              jumpToEvent(ev);
            }}
          />
        ))}
        <div className="replay-pane__scrubber-playhead" style={{ left: `${playheadPct}%` }} />
        <div className="replay-pane__scrubber-handle" style={{ left: `${playheadPct}%` }} />
        <div className="replay-pane__scrubber-time">t={playheadT}ms</div>
      </div>

      {/* Main two-column area */}
      <div className="replay-pane__main">
        {/* Left: event log */}
        <div className="replay-pane__col">
          <div className="replay-pane__col-head">
            <span>Event log</span>
            <span>{currentIdx >= 0 ? `${currentIdx + 1} / ${replay.events.length}` : `— / ${replay.events.length}`}</span>
          </div>
          <ul ref={logRef} className="replay-pane__log">
            {replay.events.map((ev, i) => {
              const isActive = i === currentIdx;
              const isPast = i < currentIdx;
              const isFuture = i > currentIdx;
              const textCls =
                ev.level === "error" ? "replay-pane__log-text is-error" :
                ev.level === "warn"  ? "replay-pane__log-text is-warn"  :
                                       "replay-pane__log-text";
              return (
                <li
                  key={ev.id}
                  ref={isActive ? activeRowRef : null}
                  className={
                    "replay-pane__log-row" +
                    (isActive ? " is-active" : "") +
                    (isPast ? " is-past" : "") +
                    (isFuture ? " is-future" : "")
                  }
                  onClick={() => jumpToEvent(ev)}
                >
                  <span className="replay-pane__log-time">{ev.t}ms</span>
                  <span
                    className="replay-pane__log-kind"
                    style={{ background: KIND_BG[ev.kind], marginLeft: ev.depth * 8 }}
                    title={ev.kind}
                  >
                    {KIND_CHAR[ev.kind]}
                  </span>
                  <div className="replay-pane__log-body">
                    <div className="replay-pane__log-head">
                      <span className="replay-pane__log-frame">{ev.frame}</span>
                      <span className={textCls}>{ev.text}</span>
                    </div>
                    {ev.detail ? <div className="replay-pane__log-detail">{ev.detail}</div> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right: call stack + vars */}
        <div className="replay-pane__col replay-pane__right">
          <div className="replay-pane__col-head">
            <span>Call stack</span>
            <span>depth {stack.length}</span>
          </div>
          {stack.length === 0 ? (
            <div className="replay-pane__stack-empty">(no active frames)</div>
          ) : (
            <ul className="replay-pane__stack">
              {stack.map((s, i) => {
                const isTop = i === stack.length - 1;
                return (
                  <li
                    key={`${s.id}-${i}`}
                    className={"replay-pane__stack-row" + (isTop ? " is-top" : "")}
                  >
                    <span className="replay-pane__stack-depth">{i}</span>
                    <span className="replay-pane__stack-frame">{s.frame}</span>
                    <span className="replay-pane__stack-line">L{s.line}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="replay-pane__vars-head">
            <span>Variables {snapshot ? `· ${snapshot.frame} @ t=${snapshot.t}ms` : ""}</span>
            <span>{snapshot ? `${snapshot.vars.length} vars` : "no snapshot"}</span>
          </div>
          <ul className="replay-pane__vars">
            {snapshot && snapshot.vars.length > 0 ? (
              snapshot.vars.map((v, i) => (
                <li
                  key={`${v.name}-${i}`}
                  className={"replay-pane__var-row" + (v.changed ? " is-changed" : "")}
                >
                  <span className="replay-pane__var-name">{v.name}</span>
                  <span className="replay-pane__var-value">{v.value}</span>
                </li>
              ))
            ) : (
              <li className="replay-pane__stack-empty">(no variable snapshot at this time)</li>
            )}
          </ul>
        </div>
      </div>

      {/* Counterfactual callout */}
      {counterfactualEvent ? (
        <div className="replay-pane__cf" role="note">
          <div className="replay-pane__cf-label">
            <span className="replay-pane__cf-arrow">⤺</span>
            <span className="replay-pane__cf-tag">Counterfactual</span>
            <span className="replay-pane__cf-text">{counterfactualEvent.counterfactual}</span>
          </div>
          <button
            type="button"
            className="replay-pane__cf-btn"
            onClick={rewindToBranch}
            disabled={!replay.events.some((e) => e.kind === "branch")}
          >
            Rewind to branch
          </button>
        </div>
      ) : null}

      {/* Footer */}
      <div className="replay-pane__footer">
        <div className="replay-pane__footer-left">
          {currentEvent
            ? `L:${currentEvent.line} · ${currentEvent.frame}`
            : "L:— · (no event)"}
        </div>
        <div className="replay-pane__footer-right">
          {replay.failingLine !== undefined ? (
            <span className="replay-pane__footer-fail">Failing line: {replay.failingLine}</span>
          ) : (
            <span>no failure line</span>
          )}
        </div>
      </div>
    </div>
  );
}
