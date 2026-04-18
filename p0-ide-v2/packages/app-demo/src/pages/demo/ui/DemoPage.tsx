import { useMemo, useState } from "react";
import { findPage } from "./demo-registry";
import { DemoSidebar } from "./internal/DemoSidebar";
import { DemoCrumbs } from "./internal/DemoCrumbs";
import { DemoStage } from "./internal/DemoStage";
import { type DemoNavCtx } from "./internal/demo-nav-context";

import "./styles/demo-shell.css";
import "./styles/demo-primitives.css";
import "./styles/demo-features.css";

export { useDemoNav } from "./internal/demo-nav-context";
export type { DemoNavCtx } from "./internal/demo-nav-context";

export function DemoPage() {
  const [pageId, setPageId] = useState<string>("catalog");

  const current = findPage(pageId);
  const navCtx = useMemo<DemoNavCtx>(() => ({ navigate: setPageId }), []);

  return (
    <div className="demo-page">
      <DemoSidebar pageId={pageId} onSelect={setPageId} />
      <main className="demo-main">
        <DemoCrumbs page={current} onReset={() => setPageId("catalog")} />
        <DemoStage page={current} nav={navCtx} />
      </main>
    </div>
  );
}
