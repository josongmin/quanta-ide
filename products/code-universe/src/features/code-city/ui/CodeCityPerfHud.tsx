/**
 * Lightweight FPS readout for spotting main-thread jank (Chrome Performance ④).
 */

import { useEffect, useRef, useState, type ReactElement } from "react";

export function CodeCityPerfHud(): ReactElement {
  const [label, setLabel] = useState("—");
  const rafRef = useRef(0);
  const framesRef = useRef(0);
  const lastRef = useRef(performance.now());

  useEffect(() => {
    const tick = (t: number) => {
      framesRef.current++;
      const dt = t - lastRef.current;
      if (dt >= 600) {
        const fps = (framesRef.current / dt) * 1000;
        const ms = fps > 0.5 ? 1000 / fps : 0;
        setLabel(`${fps.toFixed(0)} fps · ${ms.toFixed(1)} ms/f`);
        framesRef.current = 0;
        lastRef.current = t;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        left: 10,
        bottom: 10,
        zIndex: 6,
        padding: "4px 8px",
        borderRadius: 6,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        lineHeight: 1.3,
        color: "rgba(226,232,240,0.85)",
        background: "rgba(15,23,42,0.72)",
        border: "1px solid rgba(148,163,184,0.25)",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {label}
    </div>
  );
}
