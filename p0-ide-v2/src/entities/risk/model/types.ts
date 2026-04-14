export interface RiskPoint {
  line: number;
  severity: 1 | 2 | 3 | 4;
  kind: "blast" | "taint" | "cpx" | "typestate" | "dead" | "arch";
}
