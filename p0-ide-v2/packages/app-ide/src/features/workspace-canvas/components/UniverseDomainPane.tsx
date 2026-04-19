import { useMemo } from "react";
import { useSceneStore } from "../store/scene-store";
import { useFeature } from "../store/feature-flags-store";
import { useFigmaMode, figmaModeStore } from "../store/figma-mode-store";
import { useInteractionStore, interactionStore } from "../store/interaction-store";
import { detectArchViolations } from "@quanta/canvas-engine";
import { summarizeDomains, type DomainSummary } from "../lib/domain-synthesis";
import { LANE_COLOR } from "../lib/constellation-layout";

// Universe domain pane (R2)
// -------------------------------------------------------------------
// Shows at the Universe LOD OR when the shell mode is `analyze` and
// the right inspector is closed. Renders a Figma-style bubble chart:
// one circle per synthesised domain, size proportional to file count,
// and a mini layer composition stripe + cross-domain coupling count.
//
// Click a bubble → filter the canvas selection to that domain's files
// via the path-query / focus machinery. This is intentionally the
// same interaction as the Saved tab's bookmarks — one "jump" verb.

const MIN_R = 26;
const MAX_R = 72;
const PAD = 18;
const WIDTH = 520;
const HEIGHT = 300;

export function UniverseDomainPane() {
  const enabled = useFeature("power.figmaShell");
  const lod = useInteractionStore(s => s.lod);
  const mode = useFigmaMode(s => s.mode);
  const graph = useSceneStore(s => s.graph);

  // Show at the two zoomed-out LODs where the pane doesn't fight
  // another overlay for real estate. In `analyze` mode the
  // Constellation view already owns the canvas so we explicitly
  // defer to it there.
  const showAtUniverse = lod === "universe" || lod === "supergalaxy";
  const active = enabled && showAtUniverse && mode !== "analyze";

  const domains = useMemo(() => {
    if (!active || !graph) return [] as readonly DomainSummary[];
    const violations = detectArchViolations(graph).violatingEdgeIds;
    return summarizeDomains(graph, violations);
  }, [active, graph]);

  if (!active || domains.length === 0) return null;

  // Simple circle pack — place circles left to right, wrap rows when
  // width exhausted. Not optimal but stable (deterministic for a given
  // domain list) and legible up to ~30 domains.
  const maxCount = Math.max(...domains.map(d => d.fileCount), 1);
  const bubbles = packBubbles(domains, maxCount);

  return (
    <div className="ws-domainpane" role="complementary" aria-label="Universe domain map">
      <div className="ws-domainpane__head">
        <span className="ws-domainpane__eyebrow">Universe · Domains</span>
        <span className="ws-domainpane__sub">{domains.length} domains · {domains.reduce((s, d) => s + d.fileCount, 0).toLocaleString()} files</span>
      </div>
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="ws-domainpane__svg"
      >
        {bubbles.map(b => {
          const d = b.domain;
          const violating = d.violationsOutbound > 0;
          return (
            <g
              key={d.id}
              transform={`translate(${b.cx}, ${b.cy})`}
              onClick={() => {
                // Pick the domain's most-connected file as the focus
                // anchor so the selection lands on a meaningful node.
                // The graph store has the files; we just select the
                // first one in this domain's list (summary is sorted
                // by centrality prior to insertion? no — it's summary
                // only; we re-derive from graph to be safe).
                const g = graph;
                if (!g) return;
                const cand = g.files.find(f => f.id.includes(`/${d.id}/`) || f.id.startsWith(`${d.id}/`));
                if (cand) {
                  interactionStore.selectFile(cand.id);
                  figmaModeStore.setRightTab("summary");
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <circle
                r={b.r}
                fill="rgba(30,41,59,0.92)"
                stroke={violating ? "#ef4444" : "rgba(148,163,184,0.4)"}
                strokeWidth={violating ? 1.5 : 1}
              />
              <LayerRing domain={d} radius={b.r - 3} />
              <text textAnchor="middle" className="ws-domainpane__lbl" y={-4}>
                {truncate(d.label, Math.max(10, Math.floor(b.r / 6)))}
              </text>
              <text textAnchor="middle" className="ws-domainpane__meta" y={12}>
                {d.fileCount}f · {d.outboundCrossDomain}→
              </text>
              {violating && (
                <text textAnchor="middle" className="ws-domainpane__warn" y={26}>
                  ⚠ {d.violationsOutbound}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="ws-domainpane__foot">
        <span className="ws-domainpane__hint">
          click a domain to focus · size = files · ring = layer mix · red border = arch violations
        </span>
      </div>
    </div>
  );
}

function LayerRing({
  domain,
  radius,
}: {
  domain: DomainSummary;
  radius: number;
}) {
  const total = Object.values(domain.layerComposition).reduce((s, n) => s + n, 0);
  if (total === 0) return null;
  // Draw a ring split into arcs by layer composition. Even with just
  // two layers this signals "mostly domain" vs "mostly infra" at a glance.
  const order: (keyof typeof LANE_COLOR)[] = ["ui", "adapter", "domain", "infra", "util", "unknown"];
  let angle = -Math.PI / 2;
  const arcs: string[] = [];
  const colors: string[] = [];
  for (const layer of order) {
    const count = domain.layerComposition[layer] ?? 0;
    if (count === 0) continue;
    const frac = count / total;
    const end = angle + frac * Math.PI * 2;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = Math.cos(angle) * radius;
    const y1 = Math.sin(angle) * radius;
    const x2 = Math.cos(end) * radius;
    const y2 = Math.sin(end) * radius;
    arcs.push(`M 0 0 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`);
    colors.push(LANE_COLOR[layer]);
    angle = end;
  }
  return (
    <g opacity={0.35}>
      {arcs.map((d, i) => <path key={i} d={d} fill={colors[i]} />)}
    </g>
  );
}

interface Bubble {
  domain: DomainSummary;
  cx: number;
  cy: number;
  r: number;
}

function packBubbles(domains: readonly DomainSummary[], maxCount: number): Bubble[] {
  const out: Bubble[] = [];
  let x = PAD;
  let y = PAD;
  let rowH = 0;
  for (const d of domains) {
    const frac = Math.sqrt(d.fileCount / Math.max(1, maxCount));
    const r = MIN_R + (MAX_R - MIN_R) * Math.max(0.18, frac);
    if (x + r * 2 > WIDTH - PAD) {
      x = PAD;
      y += rowH + PAD;
      rowH = 0;
    }
    out.push({ domain: d, cx: x + r, cy: y + r, r });
    x += r * 2 + PAD;
    if (r * 2 > rowH) rowH = r * 2;
    if (y + r * 2 > HEIGHT - PAD) break;
  }
  return out;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, Math.max(2, n - 1)) + "…";
}
