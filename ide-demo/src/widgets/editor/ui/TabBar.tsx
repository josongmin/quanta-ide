import { motion } from "framer-motion";
import { useEditorStore } from "@/app/stores/useEditorStore";
import { cn } from "@/shared/lib/cn";

/**
 * Fitts's Law: generous 36px height, full-width click target
 * Von Restorff: only active tab has color accent (blue bottom border)
 * Gestalt connectedness: active tab bottom border connects to editor content below
 */
export function TabBar() {
  const { activeFile, openFiles, setActiveFile } = useEditorStore();

  return (
    <div className="h-9 flex items-end shrink-0 overflow-x-auto border-b border-border-subtle relative">
      {openFiles.map((path) => {
        const name = path.split("/").pop();
        const isActive = path === activeFile;
        return (
          <button
            key={path}
            type="button"
            onClick={() => setActiveFile(path)}
            className={cn(
              "relative flex items-center gap-2 px-4 h-[34px] text-[11.5px] font-mono transition-all shrink-0",
              isActive
                ? "bg-white/[0.04] text-text-primary"
                : "bg-transparent text-text-muted hover:text-text-secondary hover:bg-white/[0.02]"
            )}
          >
            {/* Language indicator — preattentive: color encodes file type */}
            <span className={cn(
              "text-[9px] font-semibold uppercase tracking-wider",
              isActive ? "text-brand" : "text-text-muted/50"
            )}>
              TS
            </span>
            <span>{name}</span>

            {/* Active indicator — Gestalt connectedness to editor below */}
            {isActive && (
              <motion.div
                layoutId="tab-active"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}

            {/* Inactive separator */}
            {!isActive && (
              <div className="absolute right-0 top-2 bottom-2 w-px bg-border" />
            )}
          </button>
        );
      })}
      {/* Fill remaining space with surface-1 */}
      <div className="flex-1" />
    </div>
  );
}
