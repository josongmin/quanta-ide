import { cn } from "@quanta/ui-kit/lib";
import type { DemoPageMeta } from "../demo-registry";
import { DemoNavProvider, type DemoNavCtx } from "./demo-nav-context";

export interface DemoStageProps {
  page: DemoPageMeta;
  nav: DemoNavCtx;
}

export function DemoStage({ page, nav }: DemoStageProps) {
  return (
    <div className={cn("demo-stage", `demo-stage--${page.chrome}`)}>
      <div className="demo-stage__inner">
        <DemoNavProvider value={nav}>
          <page.Component />
        </DemoNavProvider>
      </div>
    </div>
  );
}
