"use client";

import { REPO_NAMES, type RepoName, REPOS } from "@/entities/repo/model/data";
import { cn } from "@/shared/lib/cn";

interface Props {
  current: RepoName;
  onChange: (name: RepoName) => void;
}

export function RepoTabs({ current, onChange }: Props) {
  return (
    <div className="mr-11 flex flex-wrap gap-1 rounded-xl border border-[var(--line)] bg-[var(--paper-2)] p-1">
      {REPO_NAMES.map((name) => {
        const active = name === current;
        const color = REPOS[name].color;
        return (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(name)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 font-mono text-xs font-medium transition-all",
              active
                ? "bg-[var(--paper)] text-[var(--ink)] shadow-sm"
                : "text-[var(--ink-3)] hover:bg-white/60 hover:text-[var(--ink-2)]",
            )}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: color }}
            />
            {name}
          </button>
        );
      })}
    </div>
  );
}
