import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "@/entities/theme";
import { LanguageToggle } from "@/shared/ui/LanguageToggle";
import { AuroraPicker } from "./AuroraPicker";

export function Nav() {
  const { t } = useTranslation();
  const { aurora } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-aurora", aurora);
  }, [aurora]);

  return (
    <nav>
      <div className="nav-inner">
        <div className="logo">
          {t("landing.nav.brand")}
          <span className="badge">{t("landing.nav.beta")}</span>
        </div>
        <div className="nav-actions">
          <LanguageToggle className="nav-lang-toggle" />
          <AuroraPicker />
          <button
            type="button"
            className="try-btn"
            onClick={() => { window.location.hash = "#/ide"; }}
          >
            {t("landing.nav.openIde")}
          </button>
        </div>
      </div>
    </nav>
  );
}
