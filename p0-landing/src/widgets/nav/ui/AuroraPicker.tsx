import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore, AURORA_PRESETS } from "@/entities/theme";
import { useEscapeKey, useClickOutside } from "@/shared/hooks";

export function AuroraPicker() {
  const { t } = useTranslation();
  const { aurora, setAurora } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEscapeKey(open, () => { setOpen(false); });
  useClickOutside(ref, open, () => { setOpen(false); });

  return (
    <div className="aurora-picker" ref={ref}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- decorative backdrop */}
      {open && <div className="aurora-backdrop is-open" onClick={() => { setOpen(false); }} />}
      <button type="button" className="aurora-trigger" data-aurora={aurora} onClick={() => { setOpen(!open); }} aria-expanded={open}>
        <span className="aurora-trigger-dot" />
        <span className="aurora-trigger-text">{t("landing.aurora.palette")}</span>
        <svg className="aurora-trigger-chevron" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      <div className="aurora-panel" data-open={open}>
        <p className="aurora-panel-title">{t("landing.aurora.chooseTitle")}</p>
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
  );
}
