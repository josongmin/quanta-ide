import type { RepoMeta } from "../model/types";

interface Props {
  meta: RepoMeta[];
}

export function RepoMetaGrid({ meta }: Props) {
  return (
    <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper-2)]">
      {meta.map((m, i) => (
        <div
          key={m.k}
          className={`flex flex-col gap-1 px-4 py-3.5 ${
            i < meta.length - 1 ? "border-r border-[var(--line)]" : ""
          }`}
        >
          <span className="text-[0.6rem] font-semibold uppercase tracking-widest text-[var(--ink-3)]">
            {m.k}
          </span>
          <span className="font-mono text-lg font-semibold tracking-tight text-[var(--ink)]">
            {m.v}
          </span>
        </div>
      ))}
    </div>
  );
}
