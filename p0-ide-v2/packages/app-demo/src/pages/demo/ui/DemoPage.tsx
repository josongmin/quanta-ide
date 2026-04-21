import { useCallback, useEffect, useMemo, useState } from "react";
import { useTabRoute } from "@quanta/shell-contract";
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

const DEFAULT_PAGE_ID = "catalog";

/** Pull the demo page id out of the tab's path segments, defaulting to
 *  the catalog when the URL is empty or the id doesn't resolve. */
function pageIdFromPath(segs: string[]): string {
  const raw = segs[0];
  if (!raw) return DEFAULT_PAGE_ID;
  return findPage(raw).id === raw ? raw : DEFAULT_PAGE_ID;
}

export function DemoPage() {
  const { path, setPath } = useTabRoute();
  const [pageId, setPageIdState] = useState<string>(() => pageIdFromPath(path));

  // URL → local state (back/forward, external paste).
  useEffect(() => {
    const next = pageIdFromPath(path);
    setPageIdState((prev) => (prev === next ? prev : next));
  }, [path]);

  // Local state → URL. Catalog is the default, so omit it from the path
  // to keep `#/demo` canonical; any other page lands as `#/demo/<id>`.
  // `push` mode so each page switch creates a back-button entry.
  const navigate = useCallback(
    (id: string) => {
      setPageIdState(id);
      setPath(id === DEFAULT_PAGE_ID ? [] : [id], "push");
    },
    [setPath],
  );

  const current = findPage(pageId);
  const navCtx = useMemo<DemoNavCtx>(() => ({ navigate }), [navigate]);

  return (
    <div className="demo-page">
      <DemoSidebar pageId={pageId} onSelect={navigate} />
      <main className="demo-main">
        <DemoCrumbs page={current} onReset={() => navigate(DEFAULT_PAGE_ID)} />
        <DemoStage page={current} nav={navCtx} />
      </main>
    </div>
  );
}
