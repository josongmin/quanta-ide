import { useEffect, type RefObject } from "react";
export function useClickOutside(ref: RefObject<HTMLElement | null>, active: boolean, callback: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) callback(); };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [ref, active, callback]);
}
