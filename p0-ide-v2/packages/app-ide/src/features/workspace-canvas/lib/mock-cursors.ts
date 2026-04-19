import { sceneStore } from "../store/scene-store";
import { getPresenceTransport } from "./presence-transport-ref";
import { MockPresenceTransport, type PresenceMessage } from "./presence-transport";

// NOTE: currently disabled from CollabLayer — TICK_MS tuned for when re-enabled.
// The implementation below is intentionally left intact so flipping the switch
// in CollabLayer re-animates cursors without touching this file.
//
// Mock cursor driver — spawns two fake viewers ("viewer-a" / "viewer-b") that
// random-walk across the world and occasionally snap onto a real file's rect.
// Tick rate is throttled to keep the main thread cheap; the cursor DOM layer
// should rely on CSS transitions to smooth the larger steps between ticks.
//
// Drivers emit PresenceMessages via the active PresenceTransport. When the
// transport is a MockPresenceTransport the events loop back to the in-process
// subscribers (cursors-store); swapping to WebSocketPresenceTransport makes
// the same events go out on the wire, zero code change here.

// perf: was 50ms (20Hz); raised to 500ms (2Hz) to reduce main-thread tax.
const TICK_MS = 500;
const STEP = 12;          // world-units per tick (max component delta)
const SNAP_PROBABILITY = 0.005;

interface Walker {
  id: string;
  color: number;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function seedWalkers(): Walker[] {
  return [
    { id: "viewer-a", color: 0x7dd3fc, label: "viewer-a", x: 0,   y: 0,   vx: 0, vy: 0 },
    { id: "viewer-b", color: 0xc084fc, label: "viewer-b", x: 240, y: 160, vx: 0, vy: 0 },
  ];
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function emit(msg: PresenceMessage): void {
  const tr = getPresenceTransport();
  // For mock drivers we short-circuit through the mock's own dispatch so
  // the event reaches in-process subscribers without needing a real
  // network echo-back. For WS-backed deployments, real cursor updates
  // come from `tr.send()` → server → `tr.onMessage` (handled elsewhere).
  if (tr instanceof MockPresenceTransport) {
    tr.dispatch(msg);
  } else {
    tr.send(msg);
  }
}

export function startMockCursors(): () => void {
  const walkers = seedWalkers();
  const now = Date.now();
  for (const w of walkers) {
    emit({
      kind: "presence-join",
      userId: w.id,
      label: w.label,
      color: w.color,
    });
    emit({
      kind: "cursor-update",
      userId: w.id,
      worldX: w.x,
      worldY: w.y,
      timestamp: now,
    });
  }

  const interval = window.setInterval(() => {
    const layout = sceneStore.getState().layout;
    const bounds = layout?.totalBounds;

    for (const w of walkers) {
      // Light-weight Perlin-ish drift via random-walk velocity.
      w.vx = clamp(w.vx + (Math.random() - 0.5) * 3, -STEP, STEP);
      w.vy = clamp(w.vy + (Math.random() - 0.5) * 3, -STEP, STEP);

      if (Math.random() < SNAP_PROBABILITY && layout) {
        const files = sceneStore.getState().graph?.files;
        if (files && files.length > 0) {
          const f = files[Math.floor(Math.random() * files.length)];
          const r = f ? layout.fileRects.get(f.id) : undefined;
          if (r) {
            w.x = r.x + r.w * (0.25 + Math.random() * 0.5);
            w.y = r.y + r.h * (0.25 + Math.random() * 0.5);
            w.vx = 0;
            w.vy = 0;
          }
        }
      } else {
        w.x += w.vx;
        w.y += w.vy;
      }

      if (bounds) {
        if (w.x < 0)          { w.x = 0; w.vx = Math.abs(w.vx); }
        if (w.x > bounds.w)   { w.x = bounds.w; w.vx = -Math.abs(w.vx); }
        if (w.y < 0)          { w.y = 0; w.vy = Math.abs(w.vy); }
        if (w.y > bounds.h)   { w.y = bounds.h; w.vy = -Math.abs(w.vy); }
      }

      emit({
        kind: "cursor-update",
        userId: w.id,
        worldX: w.x,
        worldY: w.y,
        timestamp: Date.now(),
      });
    }
  }, TICK_MS);

  return () => {
    window.clearInterval(interval);
    for (const w of walkers) {
      emit({ kind: "cursor-left", userId: w.id });
    }
  };
}
