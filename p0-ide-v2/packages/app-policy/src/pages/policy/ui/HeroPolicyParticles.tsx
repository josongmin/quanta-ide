import { useMemo } from "react";

const GLYPHS = [
  "~", ":", "|", "/", "\\", "#", "=", "-",
  "~/", "|:", "#=", "-|", "/\\", "=:", "~|",
  "#\n=", "|\n:", "~\n/", "/\n|", "=\n-",
];

interface Particle {
  top: number;
  left: number;
  duration: number;
  delay: number;
  tint: number;
  glyph: string;
}

export function HeroPolicyParticles({ count = 18 }: { count?: number }) {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      top: 20 + ((i * 17) % 16),
      left: 54 + ((i * 31) % 42),
      duration: 2.4 + ((i * 0.53) % 2.2),
      delay: -Math.round(((i * 0.43) % 3.8) * 100) / 100,
      tint: 0.4 + ((i * 0.09) % 0.5),
      glyph: GLYPHS[i % GLYPHS.length],
    }));
  }, [count]);

  return (
    <div className="pol-hero-particles" aria-hidden>
      {particles.map((p, i) => (
        <pre
          key={i}
          className="pol-hero-particle"
          style={{
            top: `${p.top}%`,
            left: `${p.left}%`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            color: `rgba(14, 117, 182, ${p.tint.toFixed(2)})`,
          }}
        >
          {p.glyph}
        </pre>
      ))}
    </div>
  );
}
