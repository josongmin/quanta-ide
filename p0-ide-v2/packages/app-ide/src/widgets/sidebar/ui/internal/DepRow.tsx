import { DatabaseIcon, ProjectLinkIcon, ApiIcon, ServiceIcon } from "../../lib/icons";
import type { ExternalDep } from "../../lib/sidebar.utils";

const kindIcon: Record<ExternalDep["kind"], () => React.JSX.Element> = {
  database: DatabaseIcon,
  project: ProjectLinkIcon,
  api: ApiIcon,
  service: ServiceIcon,
};

interface DepRowProps {
  dep: ExternalDep;
}

export function DepRow({ dep }: DepRowProps) {
  const Icon = kindIcon[dep.kind];
  return (
    <div className="ide-dep-row" role="listitem">
      <Icon />
      <span className="ide-dep-name">{dep.name}</span>
      {dep.label && <span className="ide-dep-label">{dep.label}</span>}
      <span className="ide-dep-kind">{dep.kind}</span>
    </div>
  );
}
