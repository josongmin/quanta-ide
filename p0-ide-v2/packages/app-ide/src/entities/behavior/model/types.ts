export interface BehaviorDiffChunk {
  line: number;
  kind: "syntax" | "semantic" | "runtime";
  summary: string;
  before?: string;
  after?: string;
}
