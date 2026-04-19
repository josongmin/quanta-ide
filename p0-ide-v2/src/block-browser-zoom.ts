// Block browser-level pinch/scroll-zoom across the entire IDE.
//
// Why: the IDE has its own in-app zoom (canvas scale, editor font-size).
// Browser pinch-zoom modifies `visualViewport.scale` which is separate
// from Chrome's Ctrl+/Ctrl- (layout) zoom shown in the omnibox — so
// users see the page "visually zoomed" while the reported zoom level
// stays at 100%. It also persists across route changes because it's
// browser state, not React state: pinching inside Code Universe and
// then navigating back to /ide/#catalog leaves the shell scaled up.
//
// How to apply: installed once at boot from main.tsx. Capture phase so
// we win before any per-element wheel handler, passive:false so
// preventDefault actually suppresses the browser's default zoom action.
// preventDefault does not stop propagation, so per-canvas zoom handlers
// still receive the event and drive their own in-app zoom.
export function installBrowserZoomBlock(): void {
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  };
  const onGesture = (e: Event) => e.preventDefault();
  document.addEventListener("wheel", onWheel, { passive: false, capture: true });
  document.addEventListener("gesturestart", onGesture, { passive: false });
  document.addEventListener("gesturechange", onGesture, { passive: false });
  document.addEventListener("gestureend", onGesture, { passive: false });
}
