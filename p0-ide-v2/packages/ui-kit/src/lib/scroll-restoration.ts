import { useEffect } from "react";
import type { RefObject } from "react";

const cache = new Map<string, number>();

export function useScrollRestoration(
  key: string,
  ref: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    // Capture the element once so the cleanup reads the SAME node that
    // was mounted during this effect run. If we read `ref.current` in
    // cleanup, a later React remount would have already swapped the ref.
    const el = ref.current;
    if (el) {
      const cached = cache.get(key);
      if (cached !== undefined) {
        el.scrollTop = cached;
      }
    }
    return () => {
      if (el) {
        cache.set(key, el.scrollTop);
      }
    };
  }, [key, ref]);
}
