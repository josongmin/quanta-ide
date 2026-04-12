import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore, AURORA_PRESETS } from "@/entities/theme";
import { useIdeTheme, type IdeTheme } from "@/features/ide-theme";
import { useEscapeKey, useClickOutside } from "@/shared/hooks";
import { IconSettings } from "@/shared/ui";
import { setLocale } from "@/i18n/i18n";
import { useRepoIcon } from "@/entities/repo";

const REPO_EMOJIS = [
  "🛵","💳","🏦","🛒","🔐","🚀","🧠","⚡","🔬","🛡️",
  "🌿","🦊","🐙","🐳","🦋","🌊","🔥","💎","🎯","📦",
  "🗂️","📊","🧩","🔧","⚙️","🌐","📡","🤖","🏗️","🎨",
];

const NONE_ICON = "□";

/* preset-locked themes ship with a fixed aurora color */
const THEME_AURORA: Partial<Record<IdeTheme, string>> = {
  "cool-gray":   "storm",
  "cool-light":  "cobalt",
  "forest":      "matcha",
  "amoled":      "void",
  "sepia":       "honey",
  "dracula":      "lavender",
  "solarized":    "ocean",
  "monokai":      "sunset",
  "nord":         "frost",
  "tokyo-night":  "midnight",
  "github-light": "cobalt",
  "paper":        "sakura",
  "catppuccin":      "rose",
  "cyberpunk":       "infrared",
  "obsidian":        "amber",
  "rose-pine":       "dusk",
  "everforest":      "emerald",
  "one-light":       "ocean",
  "rose-pine-dawn":  "sakura",
  "gruvbox-light":   "tangerine",
  "kanagawa":        "crimson",
  "midnight-blue":  "ocean",
  "deep-ocean":     "mint",
  "warm-void":      "honey",
  "slate-pro":      "cobalt",
  "parchment":      "lavender",
  "zen":            "glacier",
  "vercel":         "cobalt",
  "aurora-borealis": "mint",
  "latte":          "tangerine",
  "noctis":         "ocean",
  "horizon":        "sunset",
  "supabase":       "emerald",
  "firebase":       "amber",
  "linear":         "lavender",
  "stripe":         "lavender",
  "planetscale":    "mint",
  "figma":          "dusk",
  "turso":          "mint",
  "vercel-light":   "cobalt",
  "linear-light":   "lavender",
  "supabase-light": "emerald",
  "stripe-light":   "lavender",
  /* 색채 조화 컬렉션 */
  "amethyst":       "dusk",
  "coral-reef":     "crimson",
  "triton":         "mint",
  "matcha-smoke":   "matcha",
  "solaris":        "ocean",
  "sakura-ink":     "sakura",
  "arctic-prism":   "frost",
  "volcanic":       "sunset",
  "dusk-gradient":  "midnight",
  "mojave":         "tangerine",
  "vercel-dash":    "cobalt",
};

export function IdeSettingsMenu() {
  const { t, i18n } = useTranslation();
  const { aurora, setAurora } = useThemeStore();
  const { theme, setTheme } = useIdeTheme();

  const handleTheme = (t: IdeTheme) => {
    setTheme(t);
    const locked = THEME_AURORA[t];
    if (locked) setAurora(locked as Parameters<typeof setAurora>[0]);
  };

  const { icon: repoIcon, setIcon: setRepoIcon } = useRepoIcon();
  const canPickColor = !THEME_AURORA[theme];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const lng = i18n.resolvedLanguage?.startsWith("ko") === true ? "ko" : "en";

  useEscapeKey(open, () => { setOpen(false); });
  useClickOutside(ref, open, () => { setOpen(false); });

  return (
    <div className="ide-settings" ref={ref}>
      <button
        type="button"
        className="ide-topbar-icon-btn"
        onClick={() => { setOpen(!open); }}
        aria-expanded={open}
        aria-label={t("ide.settings.title")}
        title={t("ide.settings.title")}
      >
        <IconSettings size={16} strokeWidth={1.5} />
      </button>

      {open && (
        <div className="ide-settings-panel">
          {/* Dark Themes */}
          <div className="ide-settings-section">
            <div className="ide-settings-label">🌙 Dark</div>
            <div className="ide-settings-row">
              <button type="button" className={`ide-settings-opt${theme === "dark" ? " is-active" : ""}`} onClick={() => { handleTheme("dark"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>Dark</button>
              <button type="button" className={`ide-settings-opt${theme === "cool-gray" ? " is-active" : ""}`} onClick={() => { handleTheme("cool-gray"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9h18M9 21V9" /></svg>Gray</button>
              <button type="button" className={`ide-settings-opt${theme === "amoled" ? " is-active" : ""}`} onClick={() => { handleTheme("amoled"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>AMOLED</button>
              <button type="button" className={`ide-settings-opt${theme === "dracula" ? " is-active" : ""}`} onClick={() => { handleTheme("dracula"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>Dracula</button>
              <button type="button" className={`ide-settings-opt${theme === "monokai" ? " is-active" : ""}`} onClick={() => { handleTheme("monokai"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>Monokai</button>
              <button type="button" className={`ide-settings-opt${theme === "nord" ? " is-active" : ""}`} onClick={() => { handleTheme("nord"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l4-8 4 8"/><path d="M13 17l4-8 4 8"/><line x1="5" y1="13" x2="9" y2="13"/><line x1="15" y1="13" x2="19" y2="13"/></svg>Nord</button>
              <button type="button" className={`ide-settings-opt${theme === "tokyo-night" ? " is-active" : ""}`} onClick={() => { handleTheme("tokyo-night"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Tokyo</button>
              <button type="button" className={`ide-settings-opt${theme === "catppuccin" ? " is-active" : ""}`} onClick={() => { handleTheme("catppuccin"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M8.5 14.5s1.5 2 3.5 2 3.5-2 3.5-2"/></svg>Catppuccin</button>
              <button type="button" className={`ide-settings-opt${theme === "rose-pine" ? " is-active" : ""}`} onClick={() => { handleTheme("rose-pine"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Rosé Pine</button>
              <button type="button" className={`ide-settings-opt${theme === "kanagawa" ? " is-active" : ""}`} onClick={() => { handleTheme("kanagawa"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 17 Q6 13 12 17 Q18 21 22 17"/><path d="M2 12 Q6 8 12 12 Q18 16 22 12"/><path d="M2 7 Q6 3 12 7 Q18 11 22 7"/></svg>Kanagawa</button>
              <button type="button" className={`ide-settings-opt${theme === "midnight-blue" ? " is-active" : ""}`} onClick={() => { handleTheme("midnight-blue"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/><circle cx="17" cy="4" r="1" fill="currentColor" stroke="none"/></svg>Midnight</button>
              <button type="button" className={`ide-settings-opt${theme === "deep-ocean" ? " is-active" : ""}`} onClick={() => { handleTheme("deep-ocean"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12 Q6 8 10 12 Q14 16 18 12 Q20 10 22 12"/><path d="M2 17 Q6 13 10 17 Q14 21 18 17 Q20 15 22 17"/></svg>Deep Ocean</button>
              <button type="button" className={`ide-settings-opt${theme === "warm-void" ? " is-active" : ""}`} onClick={() => { handleTheme("warm-void"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12 Q10 9 12 12 Q14 15 16 12"/></svg>Warm Void</button>
              <button type="button" className={`ide-settings-opt${theme === "slate-pro" ? " is-active" : ""}`} onClick={() => { handleTheme("slate-pro"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h7M7 16h5"/></svg>Slate Pro</button>
              <button type="button" className={`ide-settings-opt${theme === "notion-dark" ? " is-active" : ""}`} onClick={() => { handleTheme("notion-dark"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h4v4H7z" fill="currentColor" stroke="none" opacity=".6"/><path d="M13 7h4M13 12h4M7 15h10"/></svg>Notion Dk</button>
              <button type="button" className={`ide-settings-opt${theme === "augment" ? " is-active" : ""}`} onClick={() => { handleTheme("augment"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>Augment</button>
              <button type="button" className={`ide-settings-opt${theme === "cyberpunk" ? " is-active" : ""}`} onClick={() => { handleTheme("cyberpunk"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Cyberpunk</button>
              <button type="button" className={`ide-settings-opt${theme === "obsidian" ? " is-active" : ""}`} onClick={() => { handleTheme("obsidian"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>Obsidian</button>
              <button type="button" className={`ide-settings-opt${theme === "everforest" ? " is-active" : ""}`} onClick={() => { handleTheme("everforest"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><path d="M8 6l4-4 4 4"/></svg>Everforest</button>
              <button type="button" className={`ide-settings-opt${theme === "forest" ? " is-active" : ""}`} onClick={() => { handleTheme("forest"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 22V12l-5-9-5 9v10" /><path d="M9 22V16h6v6" /></svg>Forest</button>
              <button type="button" className={`ide-settings-opt${theme === "vercel" ? " is-active" : ""}`} onClick={() => { handleTheme("vercel"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 22 20 2 20"/></svg>Vercel</button>
              <button type="button" className={`ide-settings-opt${theme === "aurora-borealis" ? " is-active" : ""}`} onClick={() => { handleTheme("aurora-borealis"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 16 Q7 10 12 14 Q17 18 22 12"/><path d="M2 11 Q7 5 12 9 Q17 13 22 7"/><path d="M2 6 Q7 2 12 5 Q17 8 22 4"/></svg>Aurora</button>
              <button type="button" className={`ide-settings-opt${theme === "noctis" ? " is-active" : ""}`} onClick={() => { handleTheme("noctis"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/><circle cx="18" cy="5" r="0.8" fill="currentColor" stroke="none"/></svg>Noctis</button>
              <button type="button" className={`ide-settings-opt${theme === "horizon" ? " is-active" : ""}`} onClick={() => { handleTheme("horizon"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M2 12h3M19 12h3"/></svg>Horizon</button>
              <button type="button" className={`ide-settings-opt${theme === "supabase" ? " is-active" : ""}`} onClick={() => { handleTheme("supabase"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5l8-2 8 2v14l-8 2-8-2z"/><path d="M12 3v18"/></svg>Supabase</button>
              <button type="button" className={`ide-settings-opt${theme === "firebase" ? " is-active" : ""}`} onClick={() => { handleTheme("firebase"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 L8 12 L4 20 L12 16 L20 20 L16 12 Z"/></svg>Firebase</button>
              <button type="button" className={`ide-settings-opt${theme === "linear" ? " is-active" : ""}`} onClick={() => { handleTheme("linear"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3 A9 9 0 0 1 21 12"/><path d="M12 3 L21 12"/></svg>Linear</button>
              <button type="button" className={`ide-settings-opt${theme === "stripe" ? " is-active" : ""}`} onClick={() => { handleTheme("stripe"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>Stripe</button>
              <button type="button" className={`ide-settings-opt${theme === "planetscale" ? " is-active" : ""}`} onClick={() => { handleTheme("planetscale"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3C9 6 7.5 9 7.5 12S9 18 12 21"/><path d="M12 3C15 6 16.5 9 16.5 12S15 18 12 21"/></svg>PlanetScale</button>
              <button type="button" className={`ide-settings-opt${theme === "figma" ? " is-active" : ""}`} onClick={() => { handleTheme("figma"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"/><path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"/><path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/><path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"/><path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z"/></svg>Figma</button>
              <button type="button" className={`ide-settings-opt${theme === "turso" ? " is-active" : ""}`} onClick={() => { handleTheme("turso"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>Turso</button>
              <button type="button" className={`ide-settings-opt${theme === "amethyst" ? " is-active" : ""}`} onClick={() => { handleTheme("amethyst"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 19 8 17 17 7 17 5 8"/><path d="M7 17 L5 22 M17 17 L19 22"/></svg>Amethyst</button>
              <button type="button" className={`ide-settings-opt${theme === "coral-reef" ? " is-active" : ""}`} onClick={() => { handleTheme("coral-reef"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22 Q8 18 8 12 Q8 6 12 2 Q16 6 16 12 Q16 18 12 22"/><path d="M2 12 Q6 8 12 12 Q18 16 22 12"/></svg>Coral</button>
              <button type="button" className={`ide-settings-opt${theme === "triton" ? " is-active" : ""}`} onClick={() => { handleTheme("triton"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M4.93 4.93l14.14 14.14M2 12h20M4.93 19.07l14.14-14.14"/></svg>Triton</button>
              <button type="button" className={`ide-settings-opt${theme === "matcha-smoke" ? " is-active" : ""}`} onClick={() => { handleTheme("matcha-smoke"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 20"/><path d="M19 4.06C17.62 8.5 13 11.27 9 13.6"/></svg>Matcha</button>
              <button type="button" className={`ide-settings-opt${theme === "solaris" ? " is-active" : ""}`} onClick={() => { handleTheme("solaris"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"/></svg>Solaris</button>
              <button type="button" className={`ide-settings-opt${theme === "volcanic" ? " is-active" : ""}`} onClick={() => { handleTheme("volcanic"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21 L4 21 L9 12 L7 8 L12 2 L17 8 L15 12 L20 21 L16 21"/><path d="M8 21 L16 21"/></svg>Volcanic</button>
              <button type="button" className={`ide-settings-opt${theme === "dusk-gradient" ? " is-active" : ""}`} onClick={() => { handleTheme("dusk-gradient"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18 Q7 10 12 14 Q17 18 22 10"/><path d="M2 12 Q7 6 12 10 Q17 14 22 6"/><path d="M2 22 L22 22"/></svg>Dusk</button>
            </div>
          </div>

          <div className="ide-settings-divider" />

          {/* Light Themes */}
          <div className="ide-settings-section">
            <div className="ide-settings-label">☀️ Light</div>
            <div className="ide-settings-row">
              <button type="button" className={`ide-settings-opt${theme === "light" ? " is-active" : ""}`} onClick={() => { handleTheme("light"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg>Light</button>
              <button type="button" className={`ide-settings-opt${theme === "cool-light" ? " is-active" : ""}`} onClick={() => { handleTheme("cool-light"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" /><path d="M19 3v4M21 5h-4" /></svg>Light+</button>
              <button type="button" className={`ide-settings-opt${theme === "github-light" ? " is-active" : ""}`} onClick={() => { handleTheme("github-light"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>GitHub</button>
              <button type="button" className={`ide-settings-opt${theme === "paper" ? " is-active" : ""}`} onClick={() => { handleTheme("paper"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Paper</button>
              <button type="button" className={`ide-settings-opt${theme === "one-light" ? " is-active" : ""}`} onClick={() => { handleTheme("one-light"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>One Light</button>
              <button type="button" className={`ide-settings-opt${theme === "rose-pine-dawn" ? " is-active" : ""}`} onClick={() => { handleTheme("rose-pine-dawn"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v1M12 20v1M4.22 4.22l.7.7M18.36 18.36l.7.7M1 12h2M21 12h2"/><circle cx="12" cy="12" r="5"/></svg>Pine Dawn</button>
              <button type="button" className={`ide-settings-opt${theme === "gruvbox-light" ? " is-active" : ""}`} onClick={() => { handleTheme("gruvbox-light"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>Gruvbox</button>
              <button type="button" className={`ide-settings-opt${theme === "notion-light" ? " is-active" : ""}`} onClick={() => { handleTheme("notion-light"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h4v4H7z" fill="currentColor" stroke="none" opacity=".4"/><path d="M13 7h4M13 12h4M7 15h10"/></svg>Notion</button>
              <button type="button" className={`ide-settings-opt${theme === "parchment" ? " is-active" : ""}`} onClick={() => { handleTheme("parchment"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>Parchment</button>
              <button type="button" className={`ide-settings-opt${theme === "zen" ? " is-active" : ""}`} onClick={() => { handleTheme("zen"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="11"/></svg>Zen</button>
              <button type="button" className={`ide-settings-opt${theme === "sepia" ? " is-active" : ""}`} onClick={() => { handleTheme("sepia"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>Sepia</button>
              <button type="button" className={`ide-settings-opt${theme === "solarized" ? " is-active" : ""}`} onClick={() => { handleTheme("solarized"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>Solarized</button>
              <button type="button" className={`ide-settings-opt${theme === "latte" ? " is-active" : ""}`} onClick={() => { handleTheme("latte"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>Latte</button>
              <button type="button" className={`ide-settings-opt${theme === "vercel-light" ? " is-active" : ""}`} onClick={() => { handleTheme("vercel-light"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 22 20 2 20"/></svg>Vercel</button>
              <button type="button" className={`ide-settings-opt${theme === "linear-light" ? " is-active" : ""}`} onClick={() => { handleTheme("linear-light"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3 A9 9 0 0 1 21 12"/><path d="M12 3 L21 12"/></svg>Linear</button>
              <button type="button" className={`ide-settings-opt${theme === "supabase-light" ? " is-active" : ""}`} onClick={() => { handleTheme("supabase-light"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5l8-2 8 2v14l-8 2-8-2z"/><path d="M12 3v18"/></svg>Supabase</button>
              <button type="button" className={`ide-settings-opt${theme === "stripe-light" ? " is-active" : ""}`} onClick={() => { handleTheme("stripe-light"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>Stripe</button>
              <button type="button" className={`ide-settings-opt${theme === "sakura-ink" ? " is-active" : ""}`} onClick={() => { handleTheme("sakura-ink"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 Q15 6 12 9 Q9 6 12 3"/><path d="M3 12 Q6 9 9 12 Q6 15 3 12"/><path d="M21 12 Q18 9 15 12 Q18 15 21 12"/><path d="M12 21 Q15 18 12 15 Q9 18 12 21"/><circle cx="12" cy="12" r="2"/></svg>Sakura</button>
              <button type="button" className={`ide-settings-opt${theme === "arctic-prism" ? " is-active" : ""}`} onClick={() => { handleTheme("arctic-prism"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 L12 22 M2 12 L22 12 M5 5 L19 19 M19 5 L5 19"/></svg>Arctic</button>
              <button type="button" className={`ide-settings-opt${theme === "mojave" ? " is-active" : ""}`} onClick={() => { handleTheme("mojave"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20 Q6 14 10 18 Q14 22 18 16 Q20 13 22 14"/><circle cx="18" cy="5" r="3"/><path d="M15 5 L3 5"/></svg>Mojave</button>
              <button type="button" className={`ide-settings-opt${theme === "vercel-dash" ? " is-active" : ""}`} onClick={() => { handleTheme("vercel-dash"); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 22 20 2 20"/></svg>Vercel Dash</button>
            </div>
          </div>

          <div className="ide-settings-divider" />

          {/* Language */}
          <div className="ide-settings-section">
            <div className="ide-settings-label">{t("ide.settings.language")}</div>
            <div className="ide-settings-row">
              <button type="button" className={`ide-settings-opt${lng === "en" ? " is-active" : ""}`} onClick={() => { setLocale("en"); }}>EN</button>
              <button type="button" className={`ide-settings-opt${lng === "ko" ? " is-active" : ""}`} onClick={() => { setLocale("ko"); }}>KO</button>
            </div>
          </div>

          {/* Repo icon picker */}
          <div className="ide-settings-divider" />
          <div className="ide-settings-section">
            <div className="ide-settings-label">프로젝트 아이콘</div>
            <div className="ide-emoji-grid">
              <button
                type="button"
                className={`ide-emoji-opt${repoIcon === null ? " is-active" : ""}`}
                onClick={() => { setRepoIcon(null); }}
                title="기본 아이콘"
              >
                <span className="ide-emoji-none">{NONE_ICON}</span>
              </button>
              {REPO_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`ide-emoji-opt${repoIcon === e ? " is-active" : ""}`}
                  onClick={() => { setRepoIcon(e); }}
                  title={e}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color — dark/light 전용 */}
          {canPickColor && (
            <>
              <div className="ide-settings-divider" />
              <div className="ide-settings-section">
                <div className="ide-settings-label">{t("ide.settings.color")}</div>
                <div className="ide-aurora-grid">
                  {AURORA_PRESETS.map((p) => (
                    <button key={p} type="button" className={`ide-aurora-opt${aurora === p ? " is-active" : ""}`} data-aurora={p} onClick={() => { setAurora(p); }} title={p}>
                      <span className="ide-aurora-opt-swatch" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
