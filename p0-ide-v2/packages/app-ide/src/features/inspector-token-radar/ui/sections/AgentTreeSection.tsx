import { useMemo, useState } from "react";
import type { AgentNode, AgentRun, FlameSlice } from "@quanta/app-ide/entities/token-radar";
import { fmtTokens, fmtUsd, fmtPct, ROLE_LABEL, roleAccentCls, SectionTitle, StackBar } from "./helpers";

/**
 * TIER 1 — Subagent tree + Token flamegraph.
 *
 * Two views, switchable: tree (nested, anomaly-aware) and flame (role share).
 * Both highlight where the run is concentrated.
 */
export function AgentTreeSection({ run }: { run: AgentRun }) {
  const [view, setView] = useState<"tree" | "flame">("tree");

  const flameSegs = useMemo(
    () =>
      run.flame.map((f) => ({
        share: f.share,
        toneCls: roleAccentCls(f.role),
        label: ROLE_LABEL[f.role],
        tooltip: `${f.role} · ${fmtPct(f.share)} · ${fmtUsd(f.costUsd)} · ${fmtTokens(f.tokens)}`,
      })),
    [run.flame],
  );

  return (
    <div className="tr-pane__section">
      <SectionTitle
        tier="t1"
        title="Subagent tree & flamegraph"
        hint="cost concentration + parent / child anomalies"
      />

      <div className="tr-pane__tree-toolbar" role="tablist" aria-label="View">
        <button
          type="button"
          className={`tr-pane__btn${view === "tree" ? " is-active" : ""}`}
          aria-pressed={view === "tree"}
          onClick={() => setView("tree")}
        >
          tree
        </button>
        <button
          type="button"
          className={`tr-pane__btn${view === "flame" ? " is-active" : ""}`}
          aria-pressed={view === "flame"}
          onClick={() => setView("flame")}
        >
          flame
        </button>
      </div>

      {view === "tree" ? (
        <div className="tr-pane__tree">
          <TreeNode node={run.agentTree} depth={0} parentCost={run.agentTree.costUsd} />
        </div>
      ) : (
        <div className="tr-pane__flame">
          <StackBar segments={flameSegs} />
          <div className="tr-pane__flame-list">
            {run.flame.map((f) => (
              <FlameRow key={f.role} slice={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TreeNode({ node, depth, parentCost }: { node: AgentNode; depth: number; parentCost: number }) {
  const sharePct = parentCost > 0 ? node.costUsd / parentCost : 1;
  const widthPct = `${(sharePct * 100).toFixed(2)}%`;
  const accent = roleAccentCls(node.role);
  return (
    <div className="tr-pane__tree-node" style={{ marginLeft: depth * 16 }}>
      <div className="tr-pane__tree-row">
        <span className={`tr-pane__chip tr-pane__chip--role ${accent}`}>{ROLE_LABEL[node.role]}</span>
        <span className="tr-pane__tree-label">{node.label}</span>
        <span className="tr-pane__tree-share">{fmtPct(sharePct)}</span>
        <span className="tr-pane__tree-cost">{fmtUsd(node.costUsd)}</span>
        <span className="tr-pane__tree-tokens">{fmtTokens(node.totalTokens)}</span>
        <span className="tr-pane__tree-calls">{node.callCount} calls</span>
      </div>
      <div className="tr-pane__tree-bar">
        <span className={`tr-pane__tree-bar-fill ${accent}`} style={{ width: widthPct }} />
      </div>
      {node.anomalyHint && (
        <div className="tr-pane__tree-anomaly">
          <span className="tr-pane__chip tr-pane__chip--warn">anomaly</span>
          {node.anomalyHint}
        </div>
      )}
      {node.children.map((c) => (
        <TreeNode key={c.id} node={c} depth={depth + 1} parentCost={node.costUsd} />
      ))}
    </div>
  );
}

function FlameRow({ slice }: { slice: FlameSlice }) {
  const accent = roleAccentCls(slice.role);
  return (
    <div className="tr-pane__flame-row">
      <div className="tr-pane__flame-row-h">
        <span className={`tr-pane__chip tr-pane__chip--role ${accent}`}>{ROLE_LABEL[slice.role]}</span>
        <span className="tr-pane__flame-row-share">{fmtPct(slice.share)}</span>
        <span className="tr-pane__flame-row-cost">{fmtUsd(slice.costUsd)}</span>
        <span className="tr-pane__flame-row-tokens">{fmtTokens(slice.tokens)}</span>
      </div>
      <div className="tr-pane__flame-sub">
        {slice.subSlices.map((sub) => (
          <div key={sub.label} className="tr-pane__flame-sub-row">
            <div className="tr-pane__flame-sub-bar">
              <span className={`tr-pane__flame-sub-fill ${accent}`} style={{ width: `${(sub.share * 100).toFixed(0)}%` }} />
            </div>
            <span className="tr-pane__flame-sub-label">{sub.label}</span>
            <span className="tr-pane__flame-sub-meta">
              {fmtPct(sub.share)} · {fmtTokens(sub.tokens)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
