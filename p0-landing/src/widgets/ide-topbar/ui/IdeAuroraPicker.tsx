import { useState, useRef, useEffect } from "react";
import { useThemeStore, AURORA_PRESETS } from "@/entities/theme";
import { useEscapeKey, useClickOutside } from "@/shared/hooks";

export function IdeAuroraPicker() {
  const { aurora, setAurora } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEscapeKey(open, () => { setOpen(false); });
  useClickOutside(ref, open, () => { setOpen(false); });

  // sync to DOM
  useEffect(() => {
    document.documentElement.setAttribute("data-aurora", aurora);
  }, [aurora]);

  return (
    <div className="ide-aurora" ref={ref}>
      <button
        type="button"
        className="ide-aurora-trigger"
        onClick={() => { setOpen(!open); }}
        aria-expanded={open}
        title="Change color theme"
      >
        <span className="ide-aurora-swatch" data-aurora={aurora} />
      </button>
      {open && (
        <div className="ide-aurora-panel">
          <div className="ide-aurora-grid">
            {AURORA_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`ide-aurora-opt${aurora === p ? " is-active" : ""}`}
                data-aurora={p}
                onClick={() => { setAurora(p); setOpen(false); }}
                title={p}
              >
                <span className="ide-aurora-opt-swatch" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
