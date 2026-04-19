import { useCallback, useEffect, useRef, useState } from "react";
import { formatMmSs, timerStore, useTimerStore } from "../store/timer-store";

// Session timer widget (review.timer)
// -----------------------------------------------------------------
// Floating pill at top-center of the canvas. The store owns state;
// this component drives the tick loop and plays the "ding" chime
// when `finishedCount` advances. Audio uses a one-shot Web Audio
// oscillator (no asset) — if Web Audio is unavailable (older
// browsers / server render), playback is silently skipped.

const PRESETS: readonly { label: string; seconds: number }[] = [
  { label: "5m", seconds: 5 * 60 },
  { label: "15m", seconds: 15 * 60 },
  { label: "30m", seconds: 30 * 60 },
];

// Lazy AudioContext — constructing eagerly triggers browser autoplay
// warnings. We create it on first use (the first timer start), which
// counts as a user gesture.
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  // Safari older than 14 exposes only the webkit-prefixed constructor.
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  const Ctor: typeof AudioContext | undefined = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

function playDing(): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    // Two-note chirp: 880 Hz → 1320 Hz, 300ms total.
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.2);
    // Soft attack + decay so it doesn't click.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch {
    // Swallow — graceful fallback if Web Audio misbehaves.
  }
}

export function SessionTimer() {
  const remainingSec = useTimerStore(s => s.remainingSec);
  const initialSec = useTimerStore(s => s.initialSec);
  const running = useTimerStore(s => s.running);
  const finishedCount = useTimerStore(s => s.finishedCount);

  const [customMin, setCustomMin] = useState<string>(() =>
    Math.max(1, Math.round(initialSec / 60)).toString());

  // Tick loop — only active while `running`. Uses a 250ms interval but
  // subtracts 1 second per store tick, checking wall-clock to stay in
  // sync if the tab is throttled.
  const lastWallRef = useRef<number>(0);
  useEffect(() => {
    if (!running) { lastWallRef.current = 0; return; }
    lastWallRef.current = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      if (lastWallRef.current === 0) { lastWallRef.current = now; return; }
      const elapsed = Math.floor((now - lastWallRef.current) / 1000);
      if (elapsed >= 1) {
        lastWallRef.current = lastWallRef.current + elapsed * 1000;
        timerStore.tick(elapsed);
      }
    }, 250);
    return () => { window.clearInterval(interval); };
  }, [running]);

  // Ding + flash when the timer finishes. Guard on prev count so we
  // only fire on the transition edge.
  const prevFinishedRef = useRef(finishedCount);
  const [flashOn, setFlashOn] = useState(false);
  useEffect(() => {
    if (finishedCount === prevFinishedRef.current) return;
    prevFinishedRef.current = finishedCount;
    playDing();
    setFlashOn(true);
    const t = window.setTimeout(() => setFlashOn(false), 1800);
    return () => { window.clearTimeout(t); };
  }, [finishedCount]);

  const onStart = useCallback(() => {
    // Instantiate audio context on user gesture to avoid autoplay block.
    getAudioCtx();
    timerStore.start();
  }, []);

  const onApplyCustom = useCallback(() => {
    const n = Number.parseInt(customMin, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    timerStore.setDuration(n * 60);
  }, [customMin]);

  const onPreset = useCallback((seconds: number) => {
    timerStore.setDuration(seconds);
    setCustomMin(Math.round(seconds / 60).toString());
  }, []);

  // Stop canvas pan/zoom from eating wheel/click inside the widget.
  const onWheel = useCallback((e: React.WheelEvent) => e.stopPropagation(), []);
  const onPointerDown = useCallback((e: React.PointerEvent) => e.stopPropagation(), []);

  const cls = `ws-session-timer${flashOn ? " ws-session-timer--flash" : ""}${running ? " ws-session-timer--running" : ""}`;

  return (
    <div
      className={cls}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="ws-session-timer__display" title="mm:ss remaining">
        {formatMmSs(remainingSec)}
      </div>
      <div className="ws-session-timer__controls">
        {PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            className={`ws-session-timer__chip${initialSec === p.seconds ? " is-on" : ""}`}
            onClick={() => onPreset(p.seconds)}
            title={`Set ${p.label}`}
          >
            {p.label}
          </button>
        ))}
        <input
          type="number"
          min="1"
          max="360"
          className="ws-session-timer__input"
          value={customMin}
          onChange={e => setCustomMin(e.target.value)}
          onBlur={onApplyCustom}
          onKeyDown={e => { if (e.key === "Enter") onApplyCustom(); }}
          title="Custom minutes"
        />
        {running ? (
          <button
            type="button"
            className="ws-session-timer__btn"
            onClick={() => timerStore.pause()}
            title="Pause"
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="ws-session-timer__btn ws-session-timer__btn--primary"
            onClick={onStart}
            title="Start"
          >
            Start
          </button>
        )}
        <button
          type="button"
          className="ws-session-timer__btn"
          onClick={() => timerStore.reset()}
          title="Reset"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
