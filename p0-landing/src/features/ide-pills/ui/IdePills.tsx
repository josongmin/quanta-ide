export interface Pill {
  label: string;
  risk?: 1 | 2 | 3 | "hot";
}

interface IdePillsProps {
  items: Pill[];
}

export function IdePills({ items }: IdePillsProps) {
  return (
    <div className="ide-pills">
      {items.map((p) => (
        <span key={p.label} className="ide-pill" data-risk={p.risk ?? 1}>
          {p.label}
        </span>
      ))}
    </div>
  );
}
