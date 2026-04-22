import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

// ViewTransition — shell-level crossfade that runs whenever the
// active view-mode key changes.
//
// Behavior
// --------
// • The incoming view mounts under a wrapper keyed by `mode` and
//   runs its entrance (opacity/scale 0.985 → 1) over 280ms.
// • The previous view is kept mounted for 200ms after the switch so
//   its exit (opacity/scale 1 → 0.985) overlaps the incoming entrance
//   by ~80ms — a single coherent motion, not two stacked fades.
// • Each overlay is its own React subtree keyed by `mode`, so a
//   rapid A → B → C switch replaces the outgoing layer wholesale
//   without leaking the intermediate (React unmounts the stale
//   outgoing node when a newer one arrives).
//
// The duration + curve intentionally match the per-view internal
// entrance animations; views still play their own motion once they
// mount — the shell contribution is the clean exit the old view was
// missing, plus a subtle scale hint so the switch reads as a single
// gesture rather than a pop.

const ENTER_MS = 280;
const EXIT_MS = 200;
const EASE = "cubic-bezier(0.22, 1, 0.28, 1)";

export const VIEW_TRANSITION_KEYFRAMES = `
@keyframes cs-view-in {
  0%   { opacity: 0; transform: scale(0.985); }
  100% { opacity: 1; transform: scale(1);     }
}
@keyframes cs-view-out {
  0%   { opacity: 1; transform: scale(1);     }
  100% { opacity: 0; transform: scale(0.985); }
}
`;

export interface ViewTransitionProps {
  /** The current active view element. Supply fresh each render; the
   *  wrapper handles keying internally. */
  children: ReactNode;
  /** The mode key that identifies the active view. Changing this
   *  triggers the crossfade. */
  mode: string;
}

interface Layer {
  mode: string;
  node: ReactNode;
}

export function ViewTransition({ children, mode }: ViewTransitionProps): ReactElement {
  // `current` is the live layer; `outgoing` is the previous layer we
  // keep briefly so its exit animation can overlap the incoming.
  const [current, setCurrent] = useState<Layer>({ mode, node: children });
  const [outgoing, setOutgoing] = useState<Layer | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the current layer's node reference fresh for in-place props
  // updates (e.g. ctx changes) without triggering a transition.
  if (current.mode === mode && current.node !== children) {
    // Cheap identity update — reassign without provoking a re-render;
    // the very next render that caused this also already carried the
    // new node through `children`, so consumers see the latest node.
    current.node = children;
  }

  useEffect(() => {
    if (mode === current.mode) return;
    // Mode flipped: the old "current" becomes outgoing, new layer
    // replaces it. Any still-running outgoing is pre-empted — React
    // will unmount it when outgoing state is overwritten.
    setOutgoing({ mode: current.mode, node: current.node });
    setCurrent({ mode, node: children });

    if (timerRef.current != null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setOutgoing(null);
      timerRef.current = null;
    }, EXIT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      {outgoing ? (
        <div
          key={`out-${outgoing.mode}`}
          aria-hidden
          style={OUTGOING_STYLE}
        >
          {outgoing.node}
        </div>
      ) : null}
      <div key={`in-${current.mode}`} style={INCOMING_STYLE}>
        {current.node}
      </div>
    </>
  );
}

const INCOMING_STYLE: CSSProperties = {
  // The wrapper itself is the animated element; it must be a sibling
  // layer so the outgoing can sit underneath during the overlap.
  position: "absolute",
  inset: 0,
  animation: `cs-view-in ${ENTER_MS}ms ${EASE} both`,
  // The wrapper is transparent; child overlays paint their own
  // backdrop. pointer-events pass through to child handlers.
  pointerEvents: "auto",
};

const OUTGOING_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  animation: `cs-view-out ${EXIT_MS}ms ${EASE} both`,
  // While fading out the old view is non-interactive — the user has
  // already committed to the new mode and its entrance is in flight.
  pointerEvents: "none",
};
