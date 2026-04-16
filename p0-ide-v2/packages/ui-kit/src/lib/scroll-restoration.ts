import { useEffect } from "react";
import type { RefObject } from "react";

const cache = new Map<string, number>();

export function useScrollRestoration(
  key: string,
  ref: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const el = ref.current;
    if (el) {
      const cached = cache.get(key);
      if (cached !== undefined) {
        el.scrollTop = cached;
      }
    }
    return () => {
      const current = ref.current;
      if (current) {
        cache.set(key, current.scrollTop);
      }
    };
  }, [key, ref]);
}
