// Service Topology — public barrel
export { ServiceTopoView } from "./ui/ServiceTopoView";
export type { ServiceTopoViewProps } from "./ui/ServiceTopoView";
export { buildServiceTopoLayout } from "./model/build-service-topo-layout";
export type {
  ServiceNode,
  ServiceEdge,
  ServiceTopoLayout,
  BuildServiceTopoLayoutOpts,
} from "./model/types";
