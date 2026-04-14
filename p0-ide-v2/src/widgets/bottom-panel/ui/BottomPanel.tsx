import { useState, type ComponentType, type ReactNode } from "react";
import "./bottom-panel.css";
import {
  WatcherIcon,
  ProblemsIcon,
  QuantaIcon,
  TerminalIcon,
  OutputIcon,
} from "../lib/icons";
import { WatcherPane } from "./panes/WatcherPane";
import { ProblemsPane } from "./panes/ProblemsPane";
import { QuantaPane } from "./panes/QuantaPane";
import { TerminalPane } from "./panes/TerminalPane";
import { OutputPane } from "./panes/OutputPane";

type TabId = "watcher" | "problems" | "quanta" | "terminal" | "output";

interface PaneDef {
  id: TabId;
  label: string;
  ariaLabel: string;
  icon: ReactNode;
  Component: ComponentType;
}

const PANES: readonly PaneDef[] = [
  { id: "watcher",  label: "Watcher",  ariaLabel: "Watcher — live blast radius",         icon: <WatcherIcon />,  Component: WatcherPane  },
  { id: "problems", label: "Problems", ariaLabel: "Problems — LSP & linter diagnostics", icon: <ProblemsIcon />, Component: ProblemsPane },
  { id: "quanta",   label: "Quanta",   ariaLabel: "Quanta engine log",                   icon: <QuantaIcon />,   Component: QuantaPane   },
  { id: "terminal", label: "Terminal", ariaLabel: "Terminal — shell session",            icon: <TerminalIcon />, Component: TerminalPane },
  { id: "output",   label: "Output",   ariaLabel: "Output — external tool logs",         icon: <OutputIcon />,   Component: OutputPane   },
];

export function BottomPanel() {
  const [active, setActive] = useState<TabId>("problems");
  const ActivePane = (PANES.find((p) => p.id === active) ?? PANES[0]).Component;

  return (
    <section className="bp" aria-label="Bottom panel">
      <nav className="bp__rail" aria-label="Bottom panel tabs">
        <ul className="bp__rail-list">
          {PANES.map((p) => {
            const isActive = p.id === active;
            return (
              <li key={p.id} className="bp__rail-item">
                <button
                  type="button"
                  className={`bp__rail-btn${isActive ? " is-active" : ""}`}
                  aria-label={p.ariaLabel}
                  aria-pressed={isActive}
                  title={p.label}
                  onClick={() => setActive(p.id)}
                >
                  <span className="bp__rail-icon" aria-hidden>{p.icon}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="bp__body">
        <ActivePane />
      </div>
    </section>
  );
}
