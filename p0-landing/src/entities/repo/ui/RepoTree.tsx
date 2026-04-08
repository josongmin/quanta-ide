interface Props {
  tree: string;
}

export function RepoTree({ tree }: Props) {
  return (
    <pre className="overflow-x-auto whitespace-pre rounded-xl border border-[var(--line)] bg-[var(--paper-2)] px-4 py-4 font-mono text-xs leading-relaxed tracking-tight text-[var(--ink)]">
      {tree}
    </pre>
  );
}
