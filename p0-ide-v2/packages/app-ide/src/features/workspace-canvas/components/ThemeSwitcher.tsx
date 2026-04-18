import { useEffect } from "react";
import { useFeature } from "../store/feature-flags-store";
import { THEMES, themeStore, useThemeStore, type Theme } from "../store/theme-store";

// Theme switcher (Batch 7 — power.themeSwitcher).
// -------------------------------------------------------------------
// Two surfaces:
//   1. <ApplyThemeAttribute /> — sets `data-ws-theme` on the canvas
//      container so the CSS variable overrides under the
//      `[data-ws-theme="..."]` scopes in workspace-canvas.css take effect.
//      When the feature is disabled we explicitly set `dark` so the UI
//      falls back to the baseline regardless of persisted preference.
//   2. <ThemeChipRow /> — three chips for the HUD's features tab.

const THEME_LABEL: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  "high-contrast": "High contrast",
};

export function ApplyThemeAttribute({ containerRef }: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const on = useFeature("power.themeSwitcher");
  const theme = useThemeStore(s => s.theme);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const effective: Theme = on ? theme : "dark";
    el.setAttribute("data-ws-theme", effective);
    return () => { el.removeAttribute("data-ws-theme"); };
  }, [on, theme, containerRef]);
  return null;
}

export function ThemeChipRow() {
  const on = useFeature("power.themeSwitcher");
  const theme = useThemeStore(s => s.theme);
  if (!on) return null;
  return (
    <div className="ws-theme-switcher" role="radiogroup" aria-label="Canvas theme">
      {THEMES.map(t => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          className={`ws-theme-switcher__chip${theme === t ? " is-on" : ""}`}
          onClick={() => themeStore.setTheme(t)}
        >
          {THEME_LABEL[t]}
        </button>
      ))}
    </div>
  );
}
