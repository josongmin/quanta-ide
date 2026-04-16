export type OutputSource = "build" | "tests" | "agent";

export interface OutputSourceMeta {
  id: OutputSource;
  label: string;
}
