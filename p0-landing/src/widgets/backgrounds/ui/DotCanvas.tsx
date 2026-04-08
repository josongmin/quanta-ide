"use client";

import { useInteractiveDots } from "@/shared/hooks/useInteractiveDots";

export function DotCanvas() {
  const canvasRef = useInteractiveDots();

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-1 h-full w-full"
      aria-hidden="true"
    />
  );
}
