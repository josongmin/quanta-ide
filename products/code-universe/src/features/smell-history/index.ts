// smell-history feature barrel
export type {
  SmellHistoryEntry,
  SmellHistoryLayout,
  SparklineBucket,
  BuildSmellHistoryLayoutOpts,
} from "./model/types";
export type { SmellKind } from "./model/types";
export { buildSmellHistoryLayout, SMELL_COLORS } from "./model/build-smell-history-layout";
export { SmellHistoryView } from "./ui/SmellHistoryView";
export { smellHistoryViewDescriptor } from "./view";
export type { SmellHistoryViewProps } from "./ui/SmellHistoryView";
