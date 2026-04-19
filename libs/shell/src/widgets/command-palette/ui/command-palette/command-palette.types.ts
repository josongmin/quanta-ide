import type {
  CommandContribution,
  FeatureRecord,
} from "@quanta/shell/stores/feature-registry";

export interface CommandEntry {
  feature: FeatureRecord;
  command: CommandContribution;
  score: number;
  titlePositions: readonly number[];
  featurePositions: readonly number[];
}

export interface GroupedEntries {
  key: string;
  label: string;
  items: CommandEntry[];
}
