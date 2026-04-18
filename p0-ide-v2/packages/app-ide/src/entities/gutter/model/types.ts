export type GutterGlyph =
  | "taint-source"
  | "taint-sink"
  | "taint-through"
  | "taint-sanitized"
  | "arch-violation"
  | "dead"
  | "typestate"
  | "incident-match"
  | "cycle"
  | "silo"
  | "god"
  | "flaky";

export interface GutterMark {
  line: number;
  glyph: GutterGlyph;
  title: string;
}
