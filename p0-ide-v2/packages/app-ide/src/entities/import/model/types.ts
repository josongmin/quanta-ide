export interface ImportFacts {
  line: number;
  module: string;
  archViolation?: { fromLayer: string; toLayer: string; rule: string };
  importsFromFile?: string;
  blastIn?: number;
}
