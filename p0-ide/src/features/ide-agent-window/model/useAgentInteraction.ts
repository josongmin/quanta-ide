import { useEffect, useRef, useState } from "react";

export function useAgentInteraction(
  close: () => void,
  minimize: (at?: { pos: { x: number; y: number }; vel: { x: number; y: number } }) => void,
  rootRef: React.RefObject<HTMLDivElement | null>,
) {
  const [pinned, setPinned] = useState(false);
  const serverOnlineRef = useRef<boolean | null>(null);

  // Escape → close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [close]);

  // mouse velocity tracking
  const lastMouse = useRef({ x: 0, y: 0, t: 0 });
  const mouseVel  = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      const dt  = now - lastMouse.current.t || 1;
      mouseVel.current = {
        x: (e.clientX - lastMouse.current.x) / dt,
        y: (e.clientY - lastMouse.current.y) / dt,
      };
      lastMouse.current = { x: e.clientX, y: e.clientY, t: now };
    };
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); };
  }, []);

  // outside click → minimize (pinned mode ignores)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pinned) return;
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        minimize({
          pos: { x: e.clientX, y: e.clientY },
          vel: { ...mouseVel.current },
        });
      }
    };
    document.addEventListener("mousedown", handler);
    return () => { document.removeEventListener("mousedown", handler); };
  }, [minimize, pinned, rootRef]);

  // server health check
  useEffect(() => {
    const ac = new AbortController();
    serverOnlineRef.current = null;
    fetch("http://127.0.0.1:8081/health", { signal: ac.signal })
      .then((r) => { serverOnlineRef.current = r.ok; })
      .catch(() => { if (!ac.signal.aborted) serverOnlineRef.current = false; });
    return () => { ac.abort(); };
  }, []);

  return { pinned, setPinned, serverOnlineRef };
}
