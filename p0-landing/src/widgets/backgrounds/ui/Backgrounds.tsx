import { useInteractiveDots } from "@/shared/hooks/useInteractiveDots";
import { usePointerGlow } from "@/shared/hooks/usePointerGlow";

export function Backgrounds() {
  const canvasRef = useInteractiveDots();
  const glowRef = usePointerGlow();

  return (
    <>
      <div className="aurora" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
      </div>
      <canvas ref={canvasRef} id="dot-canvas" aria-hidden="true" />
      <div ref={glowRef} id="pointer-glow" aria-hidden="true" />
    </>
  );
}
