import { useTranslation } from "react-i18next";
import { setLocale } from "@/i18n/i18n";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage?.startsWith("ko") === true ? "ko" : "en";
  const next = lng === "ko" ? "en" : "ko";

  return (
    <button
      type="button"
      className={className}
      onClick={() => { setLocale(next); }}
      title={t(`ide.lang.${next}`)}
      aria-label={t(`ide.lang.${next}`)}
    >
      {lng === "ko" ? "EN" : "KO"}
    </button>
  );
}
