/* eslint-disable import-x/no-named-as-default-member -- i18next instance API (use/init/changeLanguage) */
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ko from "./locales/ko.json";

export const LOCALE_STORAGE_KEY = "p0.locale";

function initialLng(): "en" | "ko" {
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
      const v = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (v === "en" || v === "ko") return v;
    }
  } catch {
    /* ignore (e.g. SSR or incomplete test mocks) */
  }
  return "ko";
}

void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ko: { translation: ko },
  },
  lng: initialLng(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function setLocale(lng: "en" | "ko"): void {
  void i18next.changeLanguage(lng);
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, lng);
  } catch {
    /* ignore (private mode / quota) */
  }
}

export default i18next;
