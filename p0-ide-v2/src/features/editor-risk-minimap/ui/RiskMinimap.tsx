import type { RiskPoint } from "@/entities/risk";

interface Props {
  points: RiskPoint[];
  totalLines: number;
  onJump?: (line: number) => void;
}

const KIND_COLOR: Record<RiskPoint["kind"], string> = {
  blast: "var(--fg-muted)",
  taint: "var(--danger)",
  cpx: "var(--fg-muted)",
  typestate: "var(--danger)",
  dead: "var(--fg-subtle)",
  arch: "var(--danger)",
};

export function RiskMinimap({ points, totalLines, onJump }: Props) {
  return (
    <div className="risk-minimap" aria-label="Risk minimap" role="group">
      {points.map((p, i) => {
        const topPct = ((p.line - 1) / Math.max(1, totalLines - 1)) * 100;
        const width = 3 + p.severity;
        return (
          <button
            key={i}
            type="button"
            className={`risk-minimap__tick risk-minimap__tick--sev-${p.severity}`}
            style={{
              top: `${topPct}%`,
              width: `${width}px`,
              background: KIND_COLOR[p.kind],
            }}
            title={`L${p.line} · ${p.kind} · sev ${p.severity}`}
            aria-label={`Jump to line ${p.line} — ${p.kind} severity ${p.severity}`}
            onClick={() => onJump?.(p.line)}
          />
        );
      })}
    </div>
  );
}
