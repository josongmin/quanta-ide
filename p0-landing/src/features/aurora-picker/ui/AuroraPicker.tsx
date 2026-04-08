"use client";

import { useState, useRef, useEffect } from "react";
import { useThemeStore } from "@/app/stores/useThemeStore";
import { PRESET_LIST } from "../model/presets";

export function AuroraPicker() {
  const { aurora, setAurora } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/18 hover:bg-white/7"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: "var(--blob1-a, #c084fc)" }}
        />
        <span>Palette</span>
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-white/10 bg-[rgba(12,10,22,0.94)] p-2 shadow-2xl backdrop-blur-2xl">
          <p className="px-2 pb-2 text-[0.62rem] font-medium uppercase tracking-wider text-white/34">
            Choose palette
          </p>
          <div className="grid grid-cols-3 gap-1" role="listbox">
            {PRESET_LIST.map((p) => (
              <button
                key={p.name}
                type="button"
                role="option"
                aria-selected={aurora === p.name}
                onClick={() => {
                  setAurora(p.name);
                  setOpen(false);
                }}
                data-aurora={p.name}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition ${
                  aurora === p.name
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/6 hover:text-white/80"
                }`}
              >
                <span className="aurora-opt-swatch h-3 w-3 rounded-full" />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
