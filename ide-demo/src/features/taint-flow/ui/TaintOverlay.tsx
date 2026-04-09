import { useEffect, useRef, useState } from "react";
import { TAINT_PATHS } from "@/entities/code/model/analysisData";
import { useEditorStore } from "@/app/stores/useEditorStore";

interface ParticleState {
  id: string;
  progress: number;
}

export function TaintOverlay() {
  const { activeFile } = useEditorStore();
  const paths = TAINT_PATHS[activeFile];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ParticleState[]>([]);
  const animRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!paths?.length) return;

    // Init particles
    particlesRef.current = [];
    for (const path of paths) {
      for (let i = 0; i < 4; i++) {
        particlesRef.current.push({ id: `${path.id}-${i}`, progress: i * 0.25 });
      }
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      setDimensions({ w: rect.width, h: rect.height });
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(parent);

    const ctx = canvas.getContext("2d")!;
    const lineHeight = 22;
    const gutterWidth = 68;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!paths) { animRef.current = requestAnimationFrame(draw); return; }

      for (const path of paths) {
        const srcY = (path.sourceLine - 1) * lineHeight + lineHeight / 2 + 12 + 22; // +22 for codelens block
        const sinkY = (path.sinkLine - 1) * lineHeight + lineHeight / 2 + 12 + 22;

        // Draw path line (subtle)
        ctx.beginPath();
        ctx.moveTo(gutterWidth + 4, srcY);
        ctx.lineTo(gutterWidth + 4, sinkY);
        ctx.strokeStyle = "rgba(255, 68, 68, 0.08)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw source/sink dots
        ctx.beginPath();
        ctx.arc(gutterWidth + 4, srcY, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#FF4444";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(gutterWidth + 4, sinkY, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#FF4444";
        ctx.fill();
      }

      // Animate particles
      for (const p of particlesRef.current) {
        p.progress += 0.003;
        if (p.progress > 1) p.progress = 0;

        const pathId = p.id.split("-")[0] + "-" + p.id.split("-")[1];
        const taintPath = paths.find((tp) => tp.id === pathId);
        if (!taintPath) continue;

        const srcY = (taintPath.sourceLine - 1) * lineHeight + lineHeight / 2 + 12 + 22;
        const sinkY = (taintPath.sinkLine - 1) * lineHeight + lineHeight / 2 + 12 + 22;
        const currentY = srcY + (sinkY - srcY) * p.progress;

        const alpha = p.progress < 0.1 ? p.progress / 0.1 : p.progress > 0.9 ? (1 - p.progress) / 0.1 : 1;

        ctx.beginPath();
        ctx.arc(gutterWidth + 4, currentY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 68, 68, ${alpha * 0.8})`;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(gutterWidth + 4, currentY, 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 68, 68, ${alpha * 0.15})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
    };
  }, [paths, activeFile]);

  if (!paths?.length) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      width={dimensions.w}
      height={dimensions.h}
    />
  );
}
