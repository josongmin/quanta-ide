import { createContext, useContext } from "react";

// ---------------------------------------------------------------------------
// Layout callbacks — Shell populates this context so IdeApp can forward
// resize deltas to Shell-managed layout state (sidebarW, inspectorW, bottomH).
// ---------------------------------------------------------------------------

export interface LayoutCallbacks {
  onResizeSidebar: (dx: number) => void;
  onResizeInspector: (dx: number) => void;
  onResizeBottom: (dy: number) => void;
}

const noop = () => {};

const LayoutContext = createContext<LayoutCallbacks>({
  onResizeSidebar: noop,
  onResizeInspector: noop,
  onResizeBottom: noop,
});

/** Wrap an IDE tab with this provider so IdeApp can read layout callbacks. */
export const LayoutProvider = LayoutContext.Provider;

/** Read Shell-provided layout resize callbacks inside IdeApp. */
export function useLayout(): LayoutCallbacks {
  return useContext(LayoutContext);
}
