import { useState } from "react";
import {
  FOLDER_DATA,
  FOLDER_TABS,
  type FolderTab,
} from "./FolderInspectorView.mock";
import { FolderOverviewPane } from "./FolderOverviewPane";
import { FolderStructurePane } from "./FolderStructurePane";
import { FolderDuplicationPane } from "./FolderDuplicationPane";
import { FolderBlastPane } from "./FolderBlastPane";
import { FolderIncidentsPane } from "./FolderIncidentsPane";
import { FolderOwnershipPane } from "./FolderOwnershipPane";

export function FolderInspectorView({ name }: { name: string }) {
  const d = FOLDER_DATA;
  const [tab, setTab] = useState<FolderTab>("overview");

  const tabCounts: Partial<Record<FolderTab, number>> = {
    structure: d.archViolations,
    duplication: d.clones.length,
    blast: d.blastCorridors.length,
    incidents: d.incidents.length,
    ownership: d.contributors.length,
  };

  return (
    <>
      <nav className="insp__modes" role="tablist" aria-label="Folder inspector tabs">
        {FOLDER_TABS.map((t) => {
          const active = t.id === tab;
          const count = tabCounts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`insp__mode${active ? " is-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span>{t.label}</span>
              {count !== undefined && count > 0 && (
                <span className="insp__mode-count">{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === "overview" && <FolderOverviewPane name={name} d={d} />}
      {tab === "structure" && <FolderStructurePane d={d} />}
      {tab === "duplication" && <FolderDuplicationPane d={d} />}
      {tab === "blast" && <FolderBlastPane d={d} />}
      {tab === "incidents" && <FolderIncidentsPane d={d} />}
      {tab === "ownership" && <FolderOwnershipPane d={d} />}
    </>
  );
}
