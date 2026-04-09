import { useEffect, useState } from "react";
import { SNAPSHOTS, useTimeTravel, type Snapshot } from "../model/useTimeTravel";

export function TimeTravelStrip() {
  const { isOpen, close, selectedId, select } = useTimeTravel();
  const [hovered, setHovered] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [isOpen, close]);

  if (!isOpen) return null;

  const selected = SNAPSHOTS.find((s) => s.id === selectedId) ?? SNAPSHOTS[SNAPSHOTS.length - 1];
  const total = SNAPSHOTS.length;

  return (
    <div className="tt-root">
      <div className="tt-strip">
        <div className="tt-label">// TIME TRAVEL</div>

        <div className="tt-track">
          <div className="tt-track-line" />
          {SNAPSHOTS.map((snap, i) => {
            const isSelected = snap.id === selectedId;
            const left = (i / (total - 1)) * 100;
            return (
              <button
                key={snap.id}
                type="button"
                className={`tt-marker${isSelected ? " is-selected" : ""}${snap.spike === true ? " is-spike" : ""}`}
                style={{ left: `${left.toString()}%` }}
                onClick={() => { select(snap.id); }}
                onMouseEnter={() => { setHovered(snap); }}
                onMouseLeave={() => { setHovered(null); }}
                aria-label={snap.label}
              >
                <span className="tt-marker-dot" />
                <span className="tt-marker-tag">{snap.ago}</span>
              </button>
            );
          })}
        </div>

        <div className="tt-meta">
          <span className="tt-meta-k">Blast</span>
          <span className="tt-meta-v">{selected.blast}</span>
          <span className="tt-meta-sep">·</span>
          <span className="tt-meta-k">Taint</span>
          <span className="tt-meta-v">{selected.taint}</span>
        </div>

        <button type="button" className="tt-close" onClick={close} aria-label="Close timeline">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>

      {hovered && (
        <div className="tt-tooltip">
          <div className="tt-tooltip-head">{hovered.label}</div>
          <div className="tt-tooltip-row">
            <span className="tt-tooltip-k">Blast</span>
            <span className="tt-tooltip-v">{hovered.blast}</span>
          </div>
          <div className="tt-tooltip-row">
            <span className="tt-tooltip-k">Taint</span>
            <span className="tt-tooltip-v">{hovered.taint}</span>
          </div>
          {hovered.commits.map((c) => (
            <div key={c.hash} className="tt-tooltip-commit">
              <span className="tt-tooltip-hash">{c.hash}</span>{" "}
              <span className="tt-tooltip-msg">{c.msg}</span>
            </div>
          ))}
          {hovered.inflection !== undefined && (
            <div className="tt-tooltip-inflection">▲ {hovered.inflection}</div>
          )}
        </div>
      )}
    </div>
  );
}
