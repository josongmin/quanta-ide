export { buildMatrixLayout } from "./model/build-matrix-layout";
export { clusterRows } from "./lib/cluster-rows";
export { MatrixView } from "./ui/MatrixView";
export { MatrixCell } from "./ui/MatrixCell";
export type {
  MatrixRow,
  MatrixCell as MatrixCellModel,
  MatrixLayout,
  MatrixLayoutResult,
  BuildMatrixLayoutOpts,
} from "./model/types";
export type { MatrixViewProps } from "./ui/MatrixView";
export type { MatrixCellProps } from "./ui/MatrixCell";
export type { ClusterRowsOpts } from "./lib/cluster-rows";
