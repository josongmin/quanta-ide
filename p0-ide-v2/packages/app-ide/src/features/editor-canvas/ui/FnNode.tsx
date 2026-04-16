import type { CanvasNode } from "@quanta/app-ide/entities/canvas";
import { cn } from "@quanta/ui-kit/lib";

interface Props {
  node: CanvasNode;
  active?: boolean;
  onClick: (id: string) => void;
  onDoubleClick: (id: string) => void;
  compact?: boolean;
}

const KIND_GLYPH: Record<string, string> = {
  class: "C", function: "ƒ", method: "m", variable: "v", parameter: "p", module: "M",
};

function riskTone(score: number): "high" | "mid" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

export function FnNode({ node, active, onClick, onDoubleClick, compact }: Props) {
  const { fn, enrichment } = node;
  const tone = riskTone(fn.riskScore);
  const sink = fn.taint === "sink";
  const source = fn.taint === "source";

  const style = compact
    ? { left: node.x, top: node.y, width: node.w, height: node.h }
    : { left: node.x, top: node.y, width: node.w };

  // Collect tags for the bottom row
  const tags: { label: string; tone?: string }[] = [];
  if (sink) tags.push({ label: "sink", tone: "danger" });
  if (source) tags.push({ label: "source", tone: "warn" });
  if (enrichment?.heat?.level === "hot") tags.push({ label: `hot ${enrichment.heat.rate ?? ""}`.trim(), tone: "danger" });
  if (enrichment?.heat?.level === "warm") tags.push({ label: "warm", tone: "warn" });
  if (enrichment?.incidentMatch) tags.push({ label: `${enrichment.incidentMatch.id} ${Math.round(enrichment.incidentMatch.similarity * 100)}%`, tone: "warn" });
  if (enrichment?.hasBehaviorChange) tags.push({ label: "changed", tone: "accent" });

  return (
    <div
      className={cn(
        "fn-node",
        `fn-node--${tone}`,
        active && "is-active",
        fn.dead && "is-dead",
        compact && "fn-node--compact",
        enrichment?.stability !== undefined && enrichment.stability < 0.5 && "fn-node--unstable",
      )}
      style={style}
      onClick={() => onClick(node.id)}
      onDoubleClick={() => onDoubleClick(node.id)}
    >
      {/* Row 1: glyph + name + risk — nothing else */}
      <div className="fn-node__head">
        <span className="fn-node__glyph">{KIND_GLYPH[fn.kind] ?? "?"}</span>
        <span className="fn-node__name" title={fn.name}>{fn.name}</span>
        <span className={cn("fn-node__risk", `fn-node__risk--${tone}`)}>{fn.riskScore}</span>
      </div>

      {/* Row 2: metrics */}
      <div className="fn-node__metrics">
        {fn.blast >= 5 && (
          <span className={cn("fn-node__chip", fn.blastCritical !== undefined && fn.blastCritical > 0 && "is-bad")}>
            <span className="fn-node__chip-k">bla</span>{fn.blast}
          </span>
        )}
        {fn.complexity >= 3 && (
          <span className="fn-node__chip">
            <span className="fn-node__chip-k">cpx</span>{fn.complexity}
          </span>
        )}
        {fn.tests.startsWith("0/") && fn.tests !== "0/0" && (
          <span className="fn-node__chip is-bad">
            <span className="fn-node__chip-k">tests</span>{fn.tests}
          </span>
        )}
        {fn.bigO && (
          <span className="fn-node__chip">
            <span className="fn-node__chip-k">O</span>{fn.bigO}
          </span>
        )}
      </div>

      {/* Row 3: tags — taint, heat, incident, behavior change */}
      {tags.length > 0 && (
        <div className="fn-node__tags">
          {tags.map((t) => (
            <span key={t.label} className={cn("fn-node__tag", t.tone && `fn-node__tag--${t.tone}`)}>{t.label}</span>
          ))}
        </div>
      )}

      {/* Row 4: hot path */}
      {enrichment?.hotPath && (
        <div className="fn-node__hotpath" title={`#${enrichment.hotPath.rank}/${enrichment.hotPath.total}`}>
          ▸ {enrichment.hotPath.label}
        </div>
      )}
    </div>
  );
}
