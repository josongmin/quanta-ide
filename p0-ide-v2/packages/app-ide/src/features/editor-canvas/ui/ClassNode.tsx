import type { ClassGroup } from "@quanta/app-ide/entities/canvas";
import { cn } from "@quanta/ui-kit/lib";
import { FnNode } from "./FnNode";

interface Props {
  group: ClassGroup;
  activeNodeId: string | null;
  onNodeClick: (id: string) => void;
  onNodeDoubleClick: (id: string) => void;
}

function riskTone(score: number): "high" | "mid" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

export function ClassNode({ group, activeNodeId, onNodeClick, onNodeDoubleClick }: Props) {
  const { fn, enrichment } = group;
  const tone = riskTone(fn.riskScore);

  // Collect tags
  const tags: { label: string; tone?: string }[] = [];
  if (enrichment?.heat) tags.push({ label: `${enrichment.heat.level} ${enrichment.heat.rate ?? ""}`.trim(), tone: enrichment.heat.level === "hot" ? "danger" : "warn" });
  if (enrichment?.incidentMatch) tags.push({ label: `${enrichment.incidentMatch.id} ${Math.round(enrichment.incidentMatch.similarity * 100)}%`, tone: "warn" });

  return (
    <div
      className={cn("class-node", `class-node--${tone}`)}
      style={{ left: group.x, top: group.y, width: group.w, height: group.h }}
    >
      {/* Row 1: glyph + name + risk */}
      <div className="class-node__header">
        <span className="class-node__glyph">C</span>
        <span className="class-node__name" title={fn.name}>{fn.name}</span>
        <span className={cn("class-node__risk", `class-node__risk--${tone}`)}>{fn.riskScore}</span>
      </div>

      {/* Row 2: metrics */}
      <div className="class-node__metrics">
        {fn.blast >= 5 && (
          <span className="class-node__chip">
            <span className="class-node__chip-k">bla</span>{fn.blast}
          </span>
        )}
        {fn.complexity >= 3 && (
          <span className="class-node__chip">
            <span className="class-node__chip-k">cpx</span>{fn.complexity}
          </span>
        )}
        {fn.tests.startsWith("0/") && fn.tests !== "0/0" && (
          <span className="class-node__chip is-bad">
            <span className="class-node__chip-k">tests</span>{fn.tests}
          </span>
        )}
      </div>

      {/* Row 3: tags */}
      {tags.length > 0 && (
        <div className="class-node__tags">
          {tags.map((t) => (
            <span key={t.label} className={cn("class-node__tag", t.tone && `class-node__tag--${t.tone}`)}>{t.label}</span>
          ))}
        </div>
      )}

      {/* Methods */}
      <div className="class-node__body">
        {group.methods.map((m) => (
          <FnNode
            key={m.id}
            node={m}
            active={m.id === activeNodeId}
            onClick={onNodeClick}
            onDoubleClick={onNodeDoubleClick}
            compact
          />
        ))}
      </div>
    </div>
  );
}
