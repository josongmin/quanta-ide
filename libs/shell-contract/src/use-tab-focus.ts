import { useEffect, useRef } from "react";

// Tab-focus lifecycle primitive.
//
// Why this exists
// ---------------
// The shell's TabRenderer keeps every tab mounted under `display: none` and
// only swaps CSS visibility when the user switches tabs. That means
// `useEffect(..., [])` — the idiom apps reach for to run "reset on entry"
// logic — fires exactly once per session: on the very first mount.
// Any subsequent re-entry inherits whatever state survived the last visit.
//
// Real incident: `debugSettingsStore.forceLod` pinned to "ground" survived
// a tab switch, forcing every visible file to render as a DOM code pane on
// re-entry. The canvas appeared frozen until the user dug into the debug
// HUD. Ad-hoc `useRef(isActive)` watchers were sprinkled in call sites to
// paper over the symptom — but every new call site re-invented the pattern
// (and got the initial-mount edge case wrong about half the time).
//
// `useTabFocus` is the single correct primitive. It fires once on the
// first render where `isActive` is true AND on every subsequent
// `false → true` transition. Nothing else — `true → false`, same-value
// renders, and re-renders with new `fn` identities do not trigger the
// callback. This matches the mental model of "whenever this tab gains
// focus, do X".
//
// Contract
// --------
//   useTabFocus(isActive, fn)
//     - isActive: boolean — the same `isActive` prop the shell injects
//       via TabAppProps.
//     - fn: () => void — called synchronously inside the layout effect
//       on focus. Captured by ref so call sites don't need useCallback —
//       the *latest* fn runs at transition time (useEffectEvent-ish).
//
// Semantics table
//   first render, isActive=true   → fn() fires
//   first render, isActive=false  → no-op
//   false → true                  → fn() fires
//   true  → false                 → no-op
//   true  → true  (prop churn)    → no-op
//   false → false (prop churn)    → no-op
//
// Non-goals
//   - Blur callbacks. If you need "on leave" cleanup, return a disposer
//     from fn and run it yourself on the next entry, or track unmount
//     via a standard useEffect cleanup. Mixing both concerns in one
//     primitive muddles the contract.
export function useTabFocus(isActive: boolean, fn: () => void): void {
  // Latest-fn ref — callers don't need useCallback and stale closures
  // can't trap us into running an obsolete reset.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // `prevActive` starts at `false` so the very first render with
  // `isActive=true` counts as a false→true transition and the effect
  // fires. If it started at `isActive`, the first-mount case would
  // silently no-op and every caller would have to add a `useEffect(..., [])`
  // alongside to cover first entry — which is exactly the pattern this
  // hook is meant to replace.
  const prevActiveRef = useRef(false);

  useEffect(() => {
    const prev = prevActiveRef.current;
    prevActiveRef.current = isActive;
    if (isActive && !prev) {
      fnRef.current();
    }
  }, [isActive]);
}
