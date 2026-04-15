import type {
  CommandContribution,
  FeatureRecord,
} from "@/shared/model/feature-registry";

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
