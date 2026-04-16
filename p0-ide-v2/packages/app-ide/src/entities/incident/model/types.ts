export interface Incident {
  id: string;
  date: string;
  title: string;
  patternKind: "taint" | "typestate" | "cpx-spike" | "arch-drift";
  confidence: number;
  matchDetail: string;
  postmortemUrl?: string;
}
