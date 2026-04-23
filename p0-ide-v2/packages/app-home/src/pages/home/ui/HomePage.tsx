import "./home-page.css";
import { AreHomePanel } from "./internal/AreHomePanel";

/**
 * Home surface. Currently hosts the ARE activity panel — goals / runs /
 * inbox — so the Home tab doubles as the autopilot control plane landing.
 * Click any card to deep-link into Autopilot.
 */
export function HomePage() {
  return (
    <div className="home-page">
      <div className="home-page__inner">
        <AreHomePanel />
      </div>
    </div>
  );
}
