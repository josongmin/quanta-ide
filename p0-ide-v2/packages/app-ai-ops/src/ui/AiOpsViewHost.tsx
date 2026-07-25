import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  useWorkspaceGraph,
  type ViewContextValue,
  type ViewDescriptor,
} from "@quanta/code-universe";

interface Props {
  descriptor: ViewDescriptor;
  onBack: () => void;
}

/**
 * Renders a single runtime ViewDescriptor's Component inside the AI Ops
 * tab. Builds a stub `ViewContextValue`:
 *   - graph: real workspace graph if available (some runtime views still
 *     gate on it for cross-references)
 *   - tree: null (runtime views are NOT workspace-tree views; if a
 *     descriptor gates on tree, it'll fall back to its empty state —
 *     which is the correct behavior for a non-workspace-scoped view)
 *   - selectedId / anchorId: null
 *   - viewportSize: measured from this host's container
 *   - dispatch: no-op (mode-switch / mindmap-overlay don't apply here)
 */
export function AiOpsViewHost({ descriptor, onBack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const graph = useWorkspaceGraph();

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setViewportSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ctx = useMemo<ViewContextValue>(
    () => ({
      graph,
      tree: null,
      selectedId: null,
      anchorId: null,
      viewportSize,
      tabId: undefined,
      dispatch: {
        selectEntity: () => undefined,
        openMindMapOn: () => undefined,
        closeMindMap: () => undefined,
        setMode: () => undefined,
      },
    }),
    [graph, viewportSize],
  );

  // Tear down on unmount — symmetric with onActivate (none for runtime).
  useEffect(() => {
    descriptor.onActivate?.(ctx);
    return () => {
      descriptor.onDeactivate?.(ctx);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptor]);

  const Component = descriptor.Component;

  return (
    <div className="aiops-host">
      <header className="aiops-host__bar">
        <button
          type="button"
          className="aiops-host__back"
          onClick={onBack}
          aria-label="Back to AI Ops launcher"
        >
          <ArrowLeft size={14} strokeWidth={1.8} aria-hidden />
          <span>AI Ops</span>
        </button>
        <span className="aiops-host__sep">·</span>
        <span className="aiops-host__glyph" aria-hidden>{descriptor.glyph}</span>
        <span className="aiops-host__title">{descriptor.label}</span>
        <span className="aiops-host__id">{descriptor.id}</span>
        <span className="aiops-host__hint">{descriptor.hint}</span>
      </header>
      <div className="aiops-host__viewport" ref={containerRef}>
        {viewportSize.w > 0 && viewportSize.h > 0 && <Component ctx={ctx} />}
      </div>
    </div>
  );
}
