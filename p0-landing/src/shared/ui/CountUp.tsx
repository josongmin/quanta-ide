import { useEffect, useRef, useState } from "react";

export function CountUp({ value, duration = 0.7 }: { value: string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef(0);
  const prevRef = useRef(value);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;

    const extract = (s: string) => {
      const m = s.match(/^([0-9][0-9,]*\.?\d*)/);
      if (!m) return null;
      const suffix = s.slice(m[0].length);
      const num = parseFloat(m[0].replace(/,/g, ""));
      const decimals = m[0].includes(".") ? (m[0].split(".")[1]?.length ?? 0) : 0;
      const hasCommas = m[0].includes(",");
      return { num, suffix, decimals, hasCommas };
    };

    const from = extract(prev);
    const to = extract(value);

    if (!from || !to || from.num === to.num) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const fmt = (n: number) => {
      let s = to.decimals > 0 ? n.toFixed(to.decimals) : Math.round(n).toString();
      if (to.hasCommas) {
        const [int, dec] = s.split(".");
        s = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dec ? `.${dec}` : "");
      }
      return s + to.suffix;
    };

    const tick = (now: number) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(fmt(from.num + (to.num - from.num) * ease));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{display}</>;
}
