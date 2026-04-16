import type { FeatureRecord } from "@/shared/model/feature-registry";

interface MoreCapabilitiesProps {
  features: FeatureRecord[];
  showBrowse: boolean;
  onRun: (feature: FeatureRecord) => void;
  onBrowseAll: () => void;
}

export function MoreCapabilities({ features, showBrowse, onRun, onBrowseAll }: MoreCapabilitiesProps) {
  return (
    <div className="hp__more">
      <div className="hp__more-label">more capabilities</div>
      <div className="hp__more-list">
        {features.map((f) => (
          <button
            key={f.id}
            type="button"
            className="hp__more-item"
            onClick={() => onRun(f)}
            title={f.description}
          >
            {f.title}
          </button>
        ))}
      </div>
      {showBrowse && (
        <button type="button" className="hp__more-browse" onClick={onBrowseAll} aria-label="Browse all capabilities">
          browse all →
        </button>
      )}
    </div>
  );
}
