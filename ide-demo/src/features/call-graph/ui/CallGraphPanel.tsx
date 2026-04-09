import { motion } from "framer-motion";
import { CALL_GRAPH, type CallGraphNode } from "@/entities/code/model/analysisData";
import { useAnalysisStore } from "@/app/stores/useAnalysisStore";
import { useEditorStore } from "@/app/stores/useEditorStore";
import { cn } from "@/shared/lib/cn";

const STATUS_STYLE: Record<string, { dot: string; text: string; label: string }> = {
  tested: { dot: "bg-risk-safe", text: "text-risk-safe", label: "tested" },
  taint: { dot: "bg-risk-critical", text: "text-risk-critical", label: "taint" },
  dead: { dot: "bg-risk-dead", text: "text-risk-dead", label: "dead" },
  untested: { dot: "bg-risk-warning", text: "text-risk-warning", label: "untested" },
  normal: { dot: "bg-risk-info", text: "text-text-secondary", label: "" },
};

function GraphNode({ node, depth = 0, index = 0 }: { node: CallGraphNode; depth?: number; index?: number }) {
  const s = STATUS_STYLE[node.status] ?? STATUS_STYLE.normal;
  const { setActiveFile, setCursorLine } = useEditorStore();

  const handleClick = () => {
    if (node.filePath) setActiveFile(node.filePath);
    if (node.line) setCursorLine(node.line);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex items-center w-full gap-2 px-2 py-1.5 rounded-sm text-[12px] font-mono text-left",
          "hover:bg-white/[0.06] cursor-pointer transition-all group"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {depth > 0 && (
          <span className="text-text-muted opacity-30 select-none">├─</span>
        )}
        <span className={cn("w-2 h-2 rounded-full shrink-0 transition-shadow", s.dot,
          node.status === "taint" && "group-hover:shadow-[0_0_8px_rgba(255,68,68,0.5)]",
          node.status === "tested" && "group-hover:shadow-[0_0_8px_rgba(68,187,68,0.4)]",
        )} />
        <span className={cn("truncate group-hover:text-text-primary transition-colors", s.text)}>{node.name}</span>
        {node.line && (
          <span className="text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity ml-auto tabular-nums">
            :{node.line}
          </span>
        )}
        {s.label && (
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider",
            node.status === "tested" && "bg-risk-safe/10 text-risk-safe",
            node.status === "taint" && "bg-risk-critical/10 text-risk-critical",
            node.status === "dead" && "bg-risk-dead/10 text-risk-dead",
            node.status === "untested" && "bg-risk-warning/10 text-risk-warning",
          )}>
            {s.label}
          </span>
        )}
      </button>
      {node.children?.map((child, i) => (
        <GraphNode key={child.name} node={child} depth={depth + 1} index={index + i + 1} />
      ))}
    </motion.div>
  );
}

export function CallGraphPanel() {
  const { blastRadius, taintPaths, affectedFiles } = useAnalysisStore();
  const root = CALL_GRAPH.processRefund;

  return (
    <div className="h-full flex flex-col">
      {/* Header — p0 code-comment style label */}
      <div className="px-3 py-2.5 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-2">
          <span className="section-label">// call graph</span>
        </div>
        {/* Mini stats */}
        <div className="flex gap-3 text-[10px] font-mono">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-risk-critical" />
            <span className="text-text-muted">blast</span>
            <motion.span key={blastRadius} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="text-risk-critical font-semibold tabular-nums">{blastRadius}</motion.span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-risk-warning" />
            <span className="text-text-muted">taint</span>
            <motion.span key={taintPaths} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="text-risk-warning font-semibold tabular-nums">{taintPaths}</motion.span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-risk-info" />
            <span className="text-text-muted">files</span>
            <motion.span key={affectedFiles} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="text-risk-info font-semibold tabular-nums">{affectedFiles}</motion.span>
          </div>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 overflow-y-auto py-2">
        {root && <GraphNode node={root} />}
      </div>

      {/* Footer — legend as pills (landing badge style) */}
      <div className="px-3 py-2 border-t border-border flex items-center gap-1.5 flex-wrap">
        {[
          { label: "tested", color: "bg-risk-safe" },
          { label: "taint", color: "bg-risk-critical" },
          { label: "dead", color: "bg-risk-dead" },
          { label: "untested", color: "bg-risk-warning" },
        ].map((l) => (
          <span key={l.label} className="pill">
            <span className={cn("w-[5px] h-[5px] rounded-full", l.color)} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
