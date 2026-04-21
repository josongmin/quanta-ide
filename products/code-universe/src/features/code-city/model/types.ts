/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CodeNode {
  id: string;
  name: string;
  type: "class" | "module" | "function";
  loc: number;
  risk: number;
  solidViolations: number;
  spaghettiFactor: number;
  testCoverage: number;
  techDebt: number;
  isDead: boolean;
  memoryLeak: boolean;
  busFactor: number;
  complexity: number;
  duplication: number;
  coupling: number;
  aiGenerated: boolean;
  isGodClass: boolean;
  dependencies: string[];
  securityLeak: boolean;
  heuristicLevel: number;
  ifNesting: number;
  blastRadius: number;
}
