import { useEffect, useRef, type RefObject } from "react";

export function useClickOutside(ref: RefObject<HTMLElement | null>, active: boolean, callback: () => void) {
  const cbRef = useRef(callback);
  useEffect(() => { cbRef.current = callback; });

  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cbRef.current();
    };
    document.addEventListener("click", handler);
    return () => { document.removeEventListener("click", handler); };
  }, [ref, active]);
}
