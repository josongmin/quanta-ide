import { useEffect, useRef } from "react";

const PULSE_COLORS = ["rgba(139,92,246,", "rgba(99,102,241,", "rgba(167,139,250,", "rgba(196,181,253,"];

interface Node { x: number; y: number }
interface Edge { a: Node; b: Node }
interface Pulse { edge: Edge; t: number; speed: number; color: string }

export function CircuitCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cvs = canvas;
    const c = ctx;

    let animId: number;
    const GRID = 28;
    const NODE_R = 1.6;

    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let pulses: Pulse[] = [];

    function build(w: number, h: number) {
      nodes = [];
      edges = [];
      pulses = [];

      const cols = Math.ceil(w / GRID) + 1;
      const rows = Math.ceil(h / GRID) + 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.72) {
            nodes.push({
              x: c * GRID + (Math.random() - 0.5) * GRID * 0.35,
              y: r * GRID + (Math.random() - 0.5) * GRID * 0.35,
            });
          }
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        let connections = 0;
        for (let j = i + 1; j < nodes.length; j++) {
          if (connections >= 3) break;
          const b = nodes[j];
          const dx = Math.abs(a.x - b.x);
          const dy = Math.abs(a.y - b.y);
          const dist = Math.sqrt(dx * dx + dy * dy);
          const aligned = dx < 6 || dy < 6;
          if (dist < GRID * 1.6 && (aligned || Math.random() < 0.25)) {
            edges.push({ a, b });
            connections++;
          }
        }
      }
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = cvs.offsetWidth;
      const h = cvs.offsetHeight;
      cvs.width = w * dpr;
      cvs.height = h * dpr;
      c.scale(dpr, dpr);
      build(w, h);
    }

    function spawnPulse() {
      if (edges.length === 0) return;
      const edge = edges[Math.floor(Math.random() * edges.length)];
      const colorBase = PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)];
      pulses.push({ edge, t: 0, speed: 0.004 + Math.random() * 0.006, color: colorBase });
    }

    let frame = 0;
    function draw() {
      const w = cvs.offsetWidth;
      const h = cvs.offsetHeight;
      c.clearRect(0, 0, w, h);

      c.lineWidth = 0.5;
      for (const { a, b } of edges) {
        c.beginPath();
        c.strokeStyle = "rgba(139,92,246,0.07)";
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }

      for (const { x, y } of nodes) {
        c.beginPath();
        c.arc(x, y, NODE_R, 0, Math.PI * 2);
        c.fillStyle = "rgba(139,92,246,0.18)";
        c.fill();
      }

      frame++;
      if (frame % 18 === 0 && pulses.length < 28) spawnPulse();

      pulses = pulses.filter(p => p.t <= 1.3);
      for (const p of pulses) {
        const { a, b } = p.edge;
        const t = Math.min(p.t, 1);
        const px = a.x + (b.x - a.x) * t;
        const py = a.y + (b.y - a.y) * t;

        const alpha = p.t > 0.8 ? Math.max(0, 1 - (p.t - 0.8) / 0.5) : 1;

        const grad = c.createRadialGradient(px, py, 0, px, py, 6);
        grad.addColorStop(0, p.color + (0.9 * alpha).toFixed(2) + ")");
        grad.addColorStop(0.4, p.color + (0.3 * alpha).toFixed(2) + ")");
        grad.addColorStop(1, p.color + "0)");
        c.beginPath();
        c.arc(px, py, 6, 0, Math.PI * 2);
        c.fillStyle = grad;
        c.fill();

        c.beginPath();
        c.arc(px, py, 1.8, 0, Math.PI * 2);
        c.fillStyle = p.color + alpha.toFixed(2) + ")";
        c.fill();

        p.t += p.speed;
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cvs);
    draw();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="circuit-canvas"
    />
  );
}
