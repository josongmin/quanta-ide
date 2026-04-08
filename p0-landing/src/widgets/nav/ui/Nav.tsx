"use client";

import "@/shared/styles/nav-hero.css";
import { AuroraPicker } from "@/features/aurora-picker/ui/AuroraPicker";

export function Nav() {
  return (
    <nav>
      <div className="nav-inner">
        <div className="logo">
          p0 Labs
          <span className="badge">BETA</span>
        </div>
        <div className="nav-actions">
          <AuroraPicker />
          <button className="try-btn">Try now</button>
        </div>
      </div>
    </nav>
  );
}
