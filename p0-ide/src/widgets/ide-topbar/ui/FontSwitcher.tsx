import { useState, useRef, useEffect } from "react";
import { useClickOutside, useEscapeKey } from "@/shared/hooks";

const UI_FONTS = [
  // ── Geometric / Neo-Grotesque ──
  { id: "satoshi",         label: "Satoshi",           family: "'Satoshi', system-ui, sans-serif" },
  { id: "general-sans",    label: "General Sans",      family: "'General Sans', system-ui, sans-serif" },
  { id: "cabinet-grotesk", label: "Cabinet Grotesk",   family: "'Cabinet Grotesk', system-ui, sans-serif" },
  { id: "clash-grotesk",   label: "Clash Grotesk",     family: "'Clash Grotesk', system-ui, sans-serif" },
  { id: "geist",           label: "Geist",             family: "'Geist', system-ui, sans-serif" },
  { id: "inter",           label: "Inter",             family: "'Inter', system-ui, sans-serif" },
  // ── Humanist / Friendly ──
  { id: "plus-jakarta",    label: "Plus Jakarta Sans", family: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { id: "dm-sans",         label: "DM Sans",           family: "'DM Sans', system-ui, sans-serif" },
  { id: "figtree",         label: "Figtree",           family: "'Figtree', system-ui, sans-serif" },
  { id: "nunito-sans",     label: "Nunito Sans",       family: "'Nunito Sans', system-ui, sans-serif" },
  { id: "outfit",          label: "Outfit",            family: "'Outfit', system-ui, sans-serif" },
  // ── Swiss / Classic ──
  { id: "helvetica",       label: "Helvetica Neue",    family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif" },
  { id: "switzer",         label: "Switzer",           family: "'Switzer', system-ui, sans-serif" },
  { id: "work-sans",       label: "Work Sans",         family: "'Work Sans', system-ui, sans-serif" },
  { id: "source-sans",     label: "Source Sans 3",     family: "'Source Sans 3', system-ui, sans-serif" },
  { id: "sf-pro",          label: "SF Pro",            family: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" },
  // ── Tech / Display ──
  { id: "space-grotesk",   label: "Space Grotesk",     family: "'Space Grotesk', system-ui, sans-serif" },
  { id: "manrope",         label: "Manrope",           family: "'Manrope', system-ui, sans-serif" },
  { id: "chillax",         label: "Chillax",           family: "'Chillax', system-ui, sans-serif" },
  { id: "raleway",         label: "Raleway",           family: "'Raleway', system-ui, sans-serif" },
  { id: "poppins",         label: "Poppins",           family: "'Poppins', system-ui, sans-serif" },
] as const;

const STORAGE_KEY = "p0-ui-font";

function getStoredFont(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? "satoshi"; } catch { return "satoshi"; }
}

function applyFont(id: string) {
  const entry = UI_FONTS.find(f => f.id === id) ?? UI_FONTS[0];
  const el = document.querySelector(".ide") as HTMLElement | null;
  if (!el) return;
  el.style.setProperty("--font-ui", entry.family);
  el.style.setProperty("--font-num", entry.family);
  el.style.setProperty("--font-mono", entry.family);
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* noop */ }
}

export function FontSwitcher() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(getStoredFont);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setOpen(false));
  useEscapeKey(() => setOpen(false));

  // Apply on mount + on change
  useEffect(() => { applyFont(active); }, [active]);

  const current = UI_FONTS.find(f => f.id === active) ?? UI_FONTS[0];

  return (
    <div className="ide-font-switcher" ref={ref}>
      <button
        type="button"
        className="ide-topbar-icon-btn"
        title={`Font: ${current.label}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      </button>

      {open && (
        <div className="ide-font-panel">
          {UI_FONTS.map(f => (
            <button
              key={f.id}
              type="button"
              className={`ide-font-opt${f.id === active ? " is-active" : ""}`}
              style={{ fontFamily: f.family }}
              onClick={() => { setActive(f.id); }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
