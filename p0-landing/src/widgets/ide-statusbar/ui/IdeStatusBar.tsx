import { useAnalysisStatus } from "@/features/ide-analysis-status";
import { useSessionTimer } from "./useSessionTimer";

interface IdeStatusBarProps {
  issues: number;
  buildState: "passed" | "failed" | "running";
  branch: string;
}

export function IdeStatusBar({ issues, buildState, branch }: IdeStatusBarProps) {
  const connection = useAnalysisStatus((s) => s.connection);
  const sessionTime = useSessionTimer();

  const connDot = connection === "connected" ? "" : connection === "reconnecting" ? " is-warn" : " is-off";
  const connLabel = connection === "connected" ? "connected" : connection === "reconnecting" ? "reconnecting…" : "disconnected";

  return (
    <footer className="ide-statusbar">
      <span className="ide-statusbar-item">
        <span className={`ide-statusbar-dot${buildState === "failed" ? " is-warn" : buildState === "running" ? " is-off" : ""}`} />
        Build {buildState}
      </span>
      <span className="ide-statusbar-item">{branch}</span>
      <span className={`ide-statusbar-item${issues > 0 ? " is-warn" : ""}`}>
        {issues} issues
      </span>
      <span className="ide-statusbar-spacer" />
      <span className="ide-statusbar-item">session {sessionTime}</span>
      <span className="ide-statusbar-item">
        <span className={`ide-statusbar-dot${connDot}`} /> {connLabel}
      </span>
    </footer>
  );
}
