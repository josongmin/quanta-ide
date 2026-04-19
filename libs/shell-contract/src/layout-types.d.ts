export interface LayoutCallbacks {
    onResizeSidebar: (dx: number) => void;
    onResizeInspector: (dx: number) => void;
    onResizeBottom: (dy: number) => void;
}
/** Wrap a tab app with this provider so it can read layout callbacks. */
export declare const LayoutProvider: import("react").Provider<LayoutCallbacks>;
/** Read Shell-provided layout resize callbacks inside a tab app. */
export declare function useLayout(): LayoutCallbacks;
