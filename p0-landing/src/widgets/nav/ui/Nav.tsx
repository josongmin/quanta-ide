import { useThemeStore, AURORA_PRESETS } from "@/app/stores/useThemeStore";
import { useState, useRef, useEffect } from "react";

export function Nav() {
  const { aurora, setAurora } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-aurora", aurora);
  }, [aurora]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("click", h); document.removeEventListener("keydown", k); };
  }, []);

  return (
    <nav>
      <div className="nav-inner">
        <div className="logo">
          p0 Labs
          <span className="badge">BETA</span>
        </div>
        <div className="nav-actions">
          <div className="aurora-picker" ref={ref}>
            {open && <div className="aurora-backdrop is-open" onClick={() => setOpen(false)} />}
            <button type="button" className="aurora-trigger" data-aurora={aurora} onClick={() => setOpen(!open)} aria-expanded={open}>
              <span className="aurora-trigger-dot" />
              <span className="aurora-trigger-text">Palette</span>
              <svg className={`aurora-trigger-chevron${open ? " rotate-180" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            <div className={`aurora-panel${open ? "" : ""}`} style={{ opacity: open ? 1 : 0, visibility: open ? "visible" : "hidden", transform: open ? "translateY(0)" : "translateY(-6px)", pointerEvents: open ? "auto" : "none" }}>
              <p className="aurora-panel-title">Choose palette</p>
              <div className="aurora-grid" role="listbox">
                {AURORA_PRESETS.map((p) => (
                  <button key={p} type="button" className={`aurora-option${aurora === p ? " is-active" : ""}`} data-aurora={p} role="option" aria-selected={aurora === p} onClick={() => { setAurora(p); setOpen(false); }}>
                    <span className="aurora-opt-swatch" />
                    <span className="aurora-opt-label">{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button className="try-btn">Try now</button>
        </div>
      </div>
    </nav>
  );
}
