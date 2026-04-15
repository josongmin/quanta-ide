import { useMemo } from "react";

const SHAPES = [
  ".", "'", "*", "+", "^", "·",
  "*.", ".'", "+*", ".^", "'*", ".+",
  "*\n.", ".\n'", "+\n*", "^\n'", "*\n*", ".\n*",
];

interface FlameParticle {
  top: number;
  left: number;
  duration: number;
  delay: number;
  tint: number;
  shape: string;
}

export function HeroAsciiFlame({ count = 22 }: { count?: number }) {
  const particles = useMemo<FlameParticle[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      top: 22 + ((i * 13) % 14),
      left: 52 + ((i * 37) % 44),
      duration: 2.0 + ((i * 0.41) % 2.0),
      delay: -Math.round(((i * 0.37) % 3.4) * 100) / 100,
      tint: 0.55 + ((i * 0.07) % 0.45),
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    }));
  }, [count]);

  return (
    <div className="ascii-flames" aria-hidden>
      {particles.map((p, i) => (
        <pre
          key={i}
          className="ascii-flame-particle"
          style={{
            top: `${p.top}%`,
            left: `${p.left}%`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            color: `rgba(255, 106, 0, ${p.tint.toFixed(2)})`,
          }}
        >
          {p.shape}
        </pre>
      ))}
    </div>
  );
}
