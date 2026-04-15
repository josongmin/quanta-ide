import type { InspectorMode } from "@/shared/model/focus-store";

export type { InspectorMode };

export interface InspectorModeMeta {
  id: InspectorMode;
  label: string;
  shortcutDigit: number;
}

export const INSPECTOR_MODES: readonly InspectorModeMeta[] = [
  { id: "overview", label: "Overview", shortcutDigit: 1 },
  { id: "flow", label: "Flow", shortcutDigit: 2 },
  { id: "blast", label: "Blast", shortcutDigit: 3 },
  { id: "incidents", label: "Incidents", shortcutDigit: 4 },
  { id: "behavior", label: "Behavior", shortcutDigit: 5 },
  { id: "ownership", label: "Ownership", shortcutDigit: 6 },
];
