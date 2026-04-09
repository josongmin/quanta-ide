import { useEffect } from "react";
import { useThemeStore } from "@/entities/theme";
import { AuroraPicker } from "./AuroraPicker";

export function Nav() {
  const { aurora } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-aurora", aurora);
  }, [aurora]);

  return (
    <nav>
      <div className="nav-inner">
        <div className="logo">
          p0 Labs
          <span className="badge">BETA</span>
        </div>
        <div className="nav-actions">
          <AuroraPicker />
          <button
            type="button"
            className="try-btn"
            onClick={() => { window.location.hash = "#/ide"; }}
          >
            Open IDE
          </button>
        </div>
      </div>
    </nav>
  );
}
