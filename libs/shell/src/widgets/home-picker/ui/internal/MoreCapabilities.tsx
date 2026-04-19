import type { FeatureRecord } from "@quanta/shell/stores/feature-registry";

interface MoreCapabilitiesProps {
  features: FeatureRecord[];
  showBrowse: boolean;
  onRun: (feature: FeatureRecord) => void;
  onBrowseAll: () => void;
}

export function MoreCapabilities({ features, showBrowse, onRun, onBrowseAll }: MoreCapabilitiesProps) {
  return (
    <div className="hp__more">
      <div className="hp__more-chips">
        {features.map((f) => (
          <button
            key={f.id}
            type="button"
            className="hp__more-chip"
            onClick={() => onRun(f)}
            title={f.description}
          >
            {f.title}
          </button>
        ))}
        {showBrowse && (
          <button type="button" className="hp__more-chip hp__more-chip--browse" onClick={onBrowseAll} aria-label="Browse all capabilities">
            All capabilities
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
