import { useEffect, useMemo, useRef, useState } from "react";
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

const readHash = (): string => {
  const h = window.location.hash.slice(1);
  return h && findPage(h).id === h ? h : "catalog";
};

export function DemoPage() {
  const [pageId, setPageId] = useState<string>(readHash);
  const didFirstSync = useRef(false);

  useEffect(() => {
    const wasFirst = !didFirstSync.current;
    didFirstSync.current = true;
    if (window.location.hash.slice(1) === pageId) return;
    if (wasFirst) {
      window.history.replaceState(null, "", `#${pageId}`);
    } else {
      window.location.hash = pageId;
    }
  }, [pageId]);

  useEffect(() => {
    const onHash = () => {
      const next = readHash();
      setPageId((prev) => (prev === next ? prev : next));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

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
