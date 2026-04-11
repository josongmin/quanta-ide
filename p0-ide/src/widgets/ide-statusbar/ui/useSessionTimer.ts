import { useEffect, useState } from "react";

export function useSessionTimer(): string {
  const [seconds, setSeconds] = useState(83); // start at 1m 23s

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => { clearInterval(id); };
  }, []);

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString()}m ${s.toString().padStart(2, "0")}s`;
}
