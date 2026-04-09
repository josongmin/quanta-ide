import { useTranslation } from "react-i18next";
import { useRepoSelection } from "@/features/repo-modal/model/useRepoSelection";

export function Hero() {
  const { t } = useTranslation();
  const { current, open, repo } = useRepoSelection();

  return (
    <main className="hero" id="hero">
      <div className="hero-copy">
        <h1>
          {t("landing.hero.line1")}
          <br />
          <span className="hero-line2">
            {t("landing.hero.line2a")}
            <em>p0</em>
            {t("landing.hero.line2b")}
          </span>
        </h1>
        <p className="sub">
          {t("landing.hero.sub1")}
          <br />
          {t("landing.hero.sub2")}
        </p>
        <div className="repo-select">
          <span className="repo-select-label">{t("landing.hero.repoLabel")}</span>
          <button type="button" className="repo-select-trigger" onClick={open} aria-haspopup="dialog">
            <span className="repo-select-dot" style={{ "--dot": repo.color } as React.CSSProperties} />
            <span className="repo-select-name">{current}</span>
            <svg className="repo-select-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
        </div>
      </div>
    </main>
  );
}
