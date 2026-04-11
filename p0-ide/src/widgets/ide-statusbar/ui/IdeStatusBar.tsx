import { useTranslation } from "react-i18next";
import { useSessionTimer } from "./useSessionTimer";

interface IdeStatusBarProps {
  issues: number;
  buildState: "passed" | "failed" | "running";
  branch: string;
}

export function IdeStatusBar({ issues, buildState, branch }: IdeStatusBarProps) {
  const { t } = useTranslation();
  const sessionTime = useSessionTimer();

  const stateLabel =
    buildState === "passed"
      ? t("ide.status.buildPassed")
      : buildState === "failed"
        ? t("ide.status.buildFailed")
        : t("ide.status.buildRunning");

  return (
    <footer className="ide-statusbar">
      {/* Left cluster — build / branch / issues */}
      <span className="ide-statusbar-item">
        <span
          className={`ide-statusbar-dot${
            buildState === "failed" ? " is-warn" : buildState === "running" ? " is-off" : ""
          }`}
        />
        {t("ide.status.build", { state: stateLabel })}
      </span>

      <span className="ide-statusbar-sep" aria-hidden />

      <span className="ide-statusbar-item" title={t("ide.status.branchTooltip")}>
        <svg className="ide-statusbar-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="4" cy="3.5" r="1.5" />
          <circle cx="4" cy="12.5" r="1.5" />
          <circle cx="12" cy="8" r="1.5" />
          <path d="M4 5v6" />
          <path d="M4 8h5a3 3 0 0 0 3-3V5" />
        </svg>
        {branch}
        <span className="ide-statusbar-dim">↑2</span>
      </span>

      <span className="ide-statusbar-sep" aria-hidden />

      <span className={`ide-statusbar-item${issues > 0 ? " is-warn" : ""}`}>
        <svg className="ide-statusbar-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v3.5" />
          <circle cx="8" cy="10.8" r="0.5" fill="currentColor" stroke="none" />
        </svg>
        {t("ide.status.issues", { count: issues })}
      </span>

      <span className="ide-statusbar-sep" aria-hidden />

      <span className="ide-statusbar-item" title={t("ide.status.indexTooltip")}>
        <svg className="ide-statusbar-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1.5v13" />
          <path d="M1.5 8h13" />
          <circle cx="8" cy="8" r="6.5" />
        </svg>
        {t("ide.status.indexed", { count: "1,284", ago: "2m" })}
      </span>

      <span className="ide-statusbar-spacer" />

      {/* Right cluster — engine / session / connection */}
      <span className="ide-statusbar-item ide-statusbar-dim" title={t("ide.status.engineTooltip")}>
        <span className="ide-statusbar-dot" />
        {t("ide.status.engine", { version: "v2.4.1" })}
      </span>

      <span className="ide-statusbar-sep" aria-hidden />

      <span className="ide-statusbar-item ide-statusbar-dim">
        <svg className="ide-statusbar-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 4.5V8l2.2 1.5" />
        </svg>
        {t("ide.status.session", { time: sessionTime })}
      </span>

      <span className="ide-statusbar-sep" aria-hidden />

      <span className="ide-statusbar-item">
        <span className="ide-statusbar-dot" /> {t("ide.status.connected")}
      </span>
    </footer>
  );
}
