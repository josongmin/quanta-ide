import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FILE_TREE, type FileNode } from "@/entities/code/model/fileTree";
import { useEditorStore } from "@/app/stores/useEditorStore";
import { SAMPLE_FILES } from "@/entities/code/model/sampleCode";
import { cn } from "@/shared/lib/cn";

/**
 * Von Restorff Effect: risk badges are the ONLY colored elements in the tree.
 * Everything else is neutral — the badge pops out preattentively.
 */
function RiskBadge({ risk }: { risk: FileNode["risk"] }) {
  if (!risk) return null;
  const styles = {
    critical: { bg: "bg-risk-critical/12", text: "text-risk-critical", glow: "shadow-[0_0_6px_rgba(255,68,68,0.15)]" },
    warning: { bg: "bg-risk-warning/12", text: "text-risk-warning", glow: "" },
    info: { bg: "bg-risk-info/10", text: "text-risk-info", glow: "" },
  };
  const s = styles[risk.level];
  return (
    <span className={cn(
      "ml-auto px-1.5 py-[1px] rounded-sm text-[9px] font-mono font-semibold tabular-nums leading-tight",
      s.bg, s.text, s.glow,
    )}>
      {risk.count}
    </span>
  );
}

/**
 * Fitts's Law: full-width click target, 28px min height for touch
 * Gestalt proximity: indent creates visual grouping without explicit borders
 */
function TreeItem({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [open, setOpen] = useState(true);
  const { activeFile, setActiveFile } = useEditorStore();
  const isActive = node.path === activeFile;
  const hasCode = node.path in SAMPLE_FILES;
  const isDir = node.type === "directory";

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (isDir) setOpen(!open);
          else if (hasCode) setActiveFile(node.path);
        }}
        className={cn(
          "flex items-center w-full gap-1.5 h-7 text-[11.5px] font-mono rounded-[3px] transition-all",
          /* Fitts: generous horizontal padding for easy click */
          "hover:bg-white/[0.04]",
          /* Von Restorff: active file gets left accent bar — only colored element */
          isActive && "bg-white/[0.06] text-text-primary",
          !isActive && "text-text-secondary",
          !hasCode && !isDir && "opacity-35 cursor-default"
        )}
        style={{ paddingLeft: `${depth * 12 + 12}px`, paddingRight: "12px" }}
      >
        {/* Chevron / file icon — Preattentive: shape encodes type */}
        {isDir ? (
          <svg className={cn("w-3 h-3 shrink-0 transition-transform duration-150 text-text-muted", open && "rotate-90")} viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 3l5 5-5 5V3z" />
          </svg>
        ) : (
          <div className="w-3 h-3 shrink-0 flex items-center justify-center">
            <div className={cn(
              "w-[6px] h-[7px] rounded-[1px]",
              isActive ? "bg-brand/60" : "bg-text-muted/30"
            )} />
          </div>
        )}

        {/* Active indicator — left accent (Gestalt: connectedness to tab bar) */}
        {isActive && (
          <motion.div
            layoutId="file-active"
            className="absolute left-0 w-[2px] h-4 rounded-r bg-brand"
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}

        <span className="truncate">{node.name}</span>
        <RiskBadge risk={node.risk} />
      </button>

      {/* Animated collapse — temporal contiguity: cause (click) and effect (collapse) are linked */}
      <AnimatePresence initial={false}>
        {isDir && open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            {node.children?.map((child) => (
              <TreeItem key={child.path} node={child} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FileTree() {
  return (
    <div className="h-full flex flex-col relative">
      <div className="px-3 py-2.5 border-b border-border">
        <span className="section-label">// explorer</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1 relative">
        {FILE_TREE.map((node) => (
          <TreeItem key={node.path} node={node} />
        ))}
      </div>
    </div>
  );
}
