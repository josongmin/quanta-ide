export const QUANTA_KINDS = ["drift", "impact", "dead", "graph", "sync"] as const;
export type QuantaEventKind = (typeof QUANTA_KINDS)[number];

export interface QuantaEvent {
  kind: QuantaEventKind;
  ts: string;
  msg: string;
  sym?: string;
}
