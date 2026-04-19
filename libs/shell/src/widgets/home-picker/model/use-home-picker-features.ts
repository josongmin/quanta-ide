import { useMemo } from "react";
import { useFeatureRegistry, type FeatureRecord } from "@quanta/shell/stores/feature-registry";
import { sortFeaturesForUser } from "../lib/home-picker.utils";

interface HomePickerFeatures {
  allFeatures: FeatureRecord[];
  primaryFeatures: FeatureRecord[];
  nonPrimary: FeatureRecord[];
  nonPrimaryCompact: FeatureRecord[];
}

export function useHomePickerFeatures(): HomePickerFeatures {
  const featuresMap = useFeatureRegistry((s) => s.features);
  const allFeatures = useMemo(() => sortFeaturesForUser(featuresMap.values()), [featuresMap]);

  const primaryFeatures = useMemo(
    () => allFeatures.filter((f) => f.primary).slice(0, 4),
    [allFeatures],
  );
  const primaryIds = useMemo(
    () => new Set(primaryFeatures.map((f) => f.id)),
    [primaryFeatures],
  );
  const nonPrimary = useMemo(
    () => allFeatures.filter((f) => !primaryIds.has(f.id)),
    [allFeatures, primaryIds],
  );
  const nonPrimaryCompact = useMemo(() => nonPrimary.slice(0, 8), [nonPrimary]);

  return { allFeatures, primaryFeatures, nonPrimary, nonPrimaryCompact };
}
