import { useState } from "react";
import { featureRegistry, type FeatureRecord } from "@quanta/shell/stores/feature-registry";
import { useHomePickerFeatures } from "../model/use-home-picker-features";
import { PrimaryCards } from "./internal/PrimaryCards";
import { MoreCapabilities } from "./internal/MoreCapabilities";
import { BrowseAll } from "./internal/BrowseAll";
import { RecentList } from "./internal/RecentList";
import "./home-picker.css";

type Choice = "repo" | "agent" | "pr";

interface HomePickerProps {
  onPick?: (choice: Choice, label: string) => void;
}

export function HomePicker(_props: HomePickerProps) {
  void _props;
  const [showAll, setShowAll] = useState(false);
  const { allFeatures, primaryFeatures, nonPrimaryCompact } = useHomePickerFeatures();

  const runNonPrimary = (f: FeatureRecord): void => {
    const first = f.commands?.[0];
    if (first) featureRegistry.runCommand(first.id);
  };

  const runCapability = (f: FeatureRecord): void => {
    if (f.primary) {
      f.primary.tileRun();
      return;
    }
    const first = f.commands?.[0];
    if (first) featureRegistry.runCommand(first.id);
  };

  return (
    <div className="hp">
      <div className="hp__inner">
        <header className="hp__head">
          <div className="hp__eyebrow">Software Intelligence Platform</div>
          <h1 className="hp__title">
            Where would you like to <em>start</em>?
          </h1>
        </header>

        <PrimaryCards features={primaryFeatures} />

        <MoreCapabilities
          features={nonPrimaryCompact}
          showBrowse={!showAll}
          onRun={runNonPrimary}
          onBrowseAll={() => setShowAll(true)}
        />

        {showAll ? (
          <BrowseAll
            allFeatures={allFeatures}
            onBack={() => setShowAll(false)}
            onRun={runCapability}
          />
        ) : (
          <RecentList />
        )}
      </div>
    </div>
  );
}
