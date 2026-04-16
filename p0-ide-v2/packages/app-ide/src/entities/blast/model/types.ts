export interface BlastTarget {
  file: string;
  riskScore: number;
  callPath: string[];
  reason: "direct-caller" | "transitive-caller" | "shared-data" | "test";
}
