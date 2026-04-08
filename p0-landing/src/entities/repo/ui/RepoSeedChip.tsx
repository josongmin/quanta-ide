"use client";

interface Props {
  label: string;
  onClick?: () => void;
}

export function RepoSeedChip({ label, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative cursor-pointer rounded-[10px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 pl-7 text-left text-sm font-medium text-[var(--ink)] transition-all duration-150 hover:translate-x-0.5 hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))] hover:bg-[var(--paper-2)] hover:shadow-sm"
    >
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold text-[var(--accent)]">
        ›
      </span>
      {label}
    </button>
  );
}
