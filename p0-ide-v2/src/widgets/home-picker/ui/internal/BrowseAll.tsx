import type { FeatureRecord } from "@/shared/model/feature-registry";
import { CATEGORIES } from "../../lib/home-picker.utils";
import { CapabilityCard } from "./CapabilityCard";

interface BrowseAllProps {
  allFeatures: FeatureRecord[];
  onBack: () => void;
  onRun: (feature: FeatureRecord) => void;
}

export function BrowseAll({ allFeatures, onBack, onRun }: BrowseAllProps) {
  return (
    <section className="hp__browse">
      <header className="hp__browse-head">
        <h3 className="hp__browse-title">All Capabilities</h3>
        <button type="button" className="hp__browse-back" onClick={onBack}>
          ← back
        </button>
      </header>
      <div className="hp__browse-cats">
        {CATEGORIES.map((cat) => {
          const items = allFeatures.filter((f) => f.category === cat.id);
          if (items.length === 0) return null;
          return (
            <div key={cat.id} className="hp__browse-cat">
              <h4 className="hp__browse-cat-label">{cat.label}</h4>
              <div className="hp__browse-grid">
                {items.map((f) => (
                  <CapabilityCard key={f.id} feature={f} onRun={() => onRun(f)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
