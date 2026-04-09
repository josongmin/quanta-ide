import { useTranslation } from "react-i18next";

export interface Pill {
  pillKey: string;
  pillParams?: Record<string, string | number>;
  risk?: 1 | 2 | 3 | "hot";
}

interface IdePillsProps {
  items: Pill[];
}

export function IdePills({ items }: IdePillsProps) {
  const { t } = useTranslation();
  return (
    <div className="ide-pills">
      {items.map((p) => (
        <span key={p.pillKey} className="ide-pill" data-risk={p.risk ?? 1}>
          {t(`ide.pills.${p.pillKey}`, p.pillParams ?? {})}
        </span>
      ))}
    </div>
  );
}
