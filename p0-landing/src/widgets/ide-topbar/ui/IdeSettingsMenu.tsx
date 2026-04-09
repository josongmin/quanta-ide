import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore, AURORA_PRESETS } from "@/entities/theme";
import { useIdeTheme } from "@/features/ide-theme";
import { useEscapeKey, useClickOutside } from "@/shared/hooks";
import { setLocale } from "@/i18n/i18n";

export function IdeSettingsMenu() {
  const { t, i18n } = useTranslation();
  const { aurora, setAurora } = useThemeStore();
  const { theme, toggle: toggleTheme } = useIdeTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const lng = i18n.resolvedLanguage?.startsWith("ko") === true ? "ko" : "en";

  useEscapeKey(open, () => { setOpen(false); });
  useClickOutside(ref, open, () => { setOpen(false); });

  return (
    <div className="ide-settings" ref={ref}>
      <button
        type="button"
        className="ide-settings-trigger"
        onClick={() => { setOpen(!open); }}
        aria-expanded={open}
        aria-label={t("ide.settings.title")}
        title={t("ide.settings.title")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div className="ide-settings-panel">
          {/* Theme */}
          <div className="ide-settings-section">
            <div className="ide-settings-label">{t("ide.settings.theme")}</div>
            <div className="ide-settings-row">
              <button
                type="button"
                className={`ide-settings-opt${theme === "dark" ? " is-active" : ""}`}
                onClick={toggleTheme}
                title={t("ide.topbar.themeDarkTitle")}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                {t("ide.settings.dark")}
              </button>
              <button
                type="button"
                className={`ide-settings-opt${theme === "light" ? " is-active" : ""}`}
                onClick={toggleTheme}
                title={t("ide.topbar.themeLightTitle")}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                {t("ide.settings.light")}
              </button>
            </div>
          </div>

          <div className="ide-settings-divider" />

          {/* Language */}
          <div className="ide-settings-section">
            <div className="ide-settings-label">{t("ide.settings.language")}</div>
            <div className="ide-settings-row">
              <button
                type="button"
                className={`ide-settings-opt${lng === "en" ? " is-active" : ""}`}
                onClick={() => { setLocale("en"); }}
              >
                EN
              </button>
              <button
                type="button"
                className={`ide-settings-opt${lng === "ko" ? " is-active" : ""}`}
                onClick={() => { setLocale("ko"); }}
              >
                KO
              </button>
            </div>
          </div>

          <div className="ide-settings-divider" />

          {/* Color */}
          <div className="ide-settings-section">
            <div className="ide-settings-label">{t("ide.settings.color")}</div>
            <div className="ide-aurora-grid">
              {AURORA_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`ide-aurora-opt${aurora === p ? " is-active" : ""}`}
                  data-aurora={p}
                  onClick={() => { setAurora(p); }}
                  title={p}
                >
                  <span className="ide-aurora-opt-swatch" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
