"use client";

import { usePointerGlow } from "@/shared/hooks/usePointerGlow";

export function PointerGlow() {
  const ref = usePointerGlow();

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-9 h-[72px] w-[72px] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--blob1-a,#c084fc)_38%,transparent)_0%,color-mix(in_srgb,var(--blob2-a,#38bdf8)_22%,transparent)_50%,transparent_100%)] opacity-70 blur-[12px]"
      aria-hidden="true"
    />
  );
}
