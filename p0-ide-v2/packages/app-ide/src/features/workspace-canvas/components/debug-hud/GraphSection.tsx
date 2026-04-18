import { useMemo } from "react";
import type { FileMetrics, WorkspaceMetrics } from "@quanta/canvas-engine";
import { useSceneStore } from "../../store/scene-store";
import { interactionStore } from "../../store/interaction-store";

// "graph" HUD tab — surfaces centrality metrics computed by
// `computeWorkspaceMetrics` alongside layout. Shows:
//   - top N files by degree (always available)
//   - top N files by betweenness (only when computed)
//   - total file/edge count
//   - compute-time readout (sampled flag when applicable)
//
// Values are sourced from `layout.metrics` so any renderer or HUD surface
// sees the same authoritative ranking.

const TOP_N = 10;

function shortName(id: string): string {
  // Display only the leaf (filename) so the ranked list stays readable at
  // HUD widths. Hovering the row reveals the full path via `title`.
  const parts = id.split("/");
  return parts[parts.length - 1] || id;
}

export function GraphSection() {
  const layout = useSceneStore(s => s.layout);
  const metrics: WorkspaceMetrics | undefined = layout?.metrics;

  // Memoize per-file lookups for the rendered rows so re-renders of the HUD
  // during panning don't re-scan perFile for each slice.
  const degRows = useMemo(() => {
    if (!metrics) return [] as Array<{ id: string; m: FileMetrics }>;
    return metrics.topByDegree.slice(0, TOP_N).map(id => ({
      id,
      m: metrics.perFile.get(id) ?? { inDegree: 0, outDegree: 0, degree: 0 },
    }));
  }, [metrics]);

  const btwRows = useMemo(() => {
    if (!metrics) return [] as Array<{ id: string; m: FileMetrics }>;
    return metrics.topByBetweenness.slice(0, TOP_N).map(id => ({
      id,
      m: metrics.perFile.get(id) ?? { inDegree: 0, outDegree: 0, degree: 0 },
    }));
  }, [metrics]);

  if (!metrics) {
    return (
      <div className="ws-debug__grid">
        <span className="ws-debug__k">status</span>
        <span className="ws-debug__v">no metrics</span>
        <span className="ws-debug__k" style={{ gridColumn: "1 / -1", opacity: 0.6 }}>
          metrics appear once layout completes.
        </span>
      </div>
    );
  }

  const hasBetweenness = btwRows.length > 0;

  return (
    <>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">files</span>
        <span className="ws-debug__v">{metrics.fileCount.toLocaleString()}</span>

        <span className="ws-debug__k">edges</span>
        <span className="ws-debug__v">{metrics.edgeCount.toLocaleString()}</span>

        <span className="ws-debug__k">compute</span>
        <span className="ws-debug__v">
          {metrics.computeMs.toFixed(1)}ms
          {metrics.betweennessSampled ? " (sampled)" : ""}
        </span>
      </div>

      <div className="ws-debug__divider">top by degree</div>
      <div className="ws-debug__grid">
        {degRows.length === 0 && (
          <>
            <span className="ws-debug__k" style={{ gridColumn: "1 / -1", opacity: 0.6 }}>
              — empty —
            </span>
          </>
        )}
        {degRows.map(({ id, m }, i) => (
          <TopRow
            key={`deg-${id}`}
            rank={i + 1}
            id={id}
            primary={`${m.degree}`}
            secondary={`${m.inDegree}in / ${m.outDegree}out`}
          />
        ))}
      </div>

      {hasBetweenness && (
        <>
          <div className="ws-debug__divider">top by betweenness</div>
          <div className="ws-debug__grid">
            {btwRows.map(({ id, m }, i) => (
              <TopRow
                key={`btw-${id}`}
                rank={i + 1}
                id={id}
                primary={((m.betweennessRank ?? 0) * 100).toFixed(1) + "%"}
                secondary={`deg ${m.degree}`}
              />
            ))}
          </div>
        </>
      )}

      {/* SCC section — import/call cycles surfaced by Tarjan's SCC pass. Each
          row is the first 3 member basenames + overflow count. Click to
          select the first member so the user can zoom to the cycle. */}
      <SCCList />

      {/* Start-here ranking — AI-assist "you should look here first" list.
          Mirrors the in-canvas badges but with full filenames + score
          breakdown. Click to select. */}
      <StartHereList />
    </>
  );
}

function SCCList() {
  const sccs = useSceneStore(s => s.layout?.sccs);
  if (!sccs || sccs.length === 0) return null;
  const shown = sccs.slice(0, 10);
  return (
    <>
      <div className="ws-debug__divider">cycles ({sccs.length})</div>
      <div className="ws-debug__grid">
        {shown.map((members, i) => {
          const head = members.slice(0, 3).map(shortName).join(", ");
          const more = members.length > 3 ? ` +${members.length - 3}` : "";
          return (
            <div
              key={`scc-${i}`}
              className="ws-debug__row"
              style={{ gridColumn: "1 / -1", cursor: "pointer" }}
              onClick={() => interactionStore.selectFile(members[0])}
              title={members.join("\n")}
            >
              <span style={{ opacity: 0.7, marginRight: 6 }}>{i + 1}.</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                {head}{more}
              </span>
              <span style={{ color: "#ea580c", fontVariantNumeric: "tabular-nums" }}>
                ·{members.length}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function StartHereList() {
  const startHere = useSceneStore(s => s.layout?.startHere);
  if (!startHere || startHere.length === 0) return null;
  return (
    <>
      <div className="ws-debug__divider">start here ({startHere.length})</div>
      <div className="ws-debug__grid">
        {startHere.slice(0, 10).map(entry => (
          <div
            key={`sh-${entry.fileId}`}
            className="ws-debug__row"
            style={{ gridColumn: "1 / -1", cursor: "pointer" }}
            onClick={() => interactionStore.selectFile(entry.fileId)}
            title={`${entry.fileId}\ncentrality ${(entry.breakdown.centrality * 100).toFixed(0)}% · entry ${(entry.breakdown.entryPoint * 100).toFixed(0)}% · risk ${(entry.breakdown.risk * 100).toFixed(0)}%`}
          >
            <span
              style={{
                display: "inline-block",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#6366f1",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                textAlign: "center",
                lineHeight: "18px",
                marginRight: 6,
              }}
            >
              {entry.rank}
            </span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
              {shortName(entry.fileId)}
            </span>
            <span style={{ opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>
              {(entry.score * 100).toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function TopRow({
  rank,
  id,
  primary,
  secondary,
}: {
  rank: number;
  id: string;
  primary: string;
  secondary: string;
}) {
  return (
    <>
      <span
        className="ws-debug__k"
        style={{ paddingLeft: 4, fontVariantNumeric: "tabular-nums", opacity: 0.85 }}
        title={id}
      >
        {rank.toString().padStart(2, " ")}. {shortName(id)}
      </span>
      <span
        className="ws-debug__v"
        style={{ fontVariantNumeric: "tabular-nums" }}
        title={`${primary} · ${secondary}`}
      >
        <span style={{ fontWeight: 600 }}>{primary}</span>
        <span style={{ marginLeft: 6, opacity: 0.6 }}>{secondary}</span>
      </span>
    </>
  );
}
