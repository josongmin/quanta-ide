import { createContext, useContext } from "react";

// ---------------------------------------------------------------------------
// Layout callbacks — Shell populates this context so tab apps can forward
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

/** Wrap a tab app with this provider so it can read layout callbacks. */
export const LayoutProvider = LayoutContext.Provider;

/** Read Shell-provided layout resize callbacks inside a tab app. */
export function useLayout(): LayoutCallbacks {
  return useContext(LayoutContext);
}
