import type { Confidence } from "@quanta/app-ide/entities/canvas";

export type { Confidence };

// ── Node kinds ──────────────────────────────────────────────────────

export type SecurityHopKind =
  | "source"     // tainted data entry point
  | "propagate"  // intermediate propagation
  | "sanitize"   // taint neutralised — safe beyond this point
  | "guard"      // authorisation / privilege check
  | "sink"       // dangerous destination
  | "gap"        // missing sanitiser / guard — vulnerability
  | "branch";    // conditional branch

// ── OWASP Top 10 ───────────────────────────────────────────────────

export type OwaspCode =
  | "A01" | "A02" | "A03" | "A04" | "A05"
  | "A06" | "A07" | "A08" | "A09" | "A10";

export const OWASP_TITLES: Record<OwaspCode, string> = {
  A01: "Broken Access Control",
  A02: "Cryptographic Failures",
  A03: "Injection",
  A04: "Insecure Design",
  A05: "Security Misconfiguration",
  A06: "Vulnerable Components",
  A07: "Auth Failures",
  A08: "Data Integrity Failures",
  A09: "Logging Failures",
  A10: "SSRF",
};

// ── Graph primitives ────────────────────────────────────────────────

export interface SecurityFlowNode {
  id: string;
  kind: SecurityHopKind;
  /** Displayed symbol / function name */
  label: string;
  file: string;
  line: number;
  col?: number;
  /** Human-readable explanation */
  detail: string;
  confidence: Confidence;
  /** Data type that flows through */
  dataType?: string;
  /** For gap nodes — what should be applied here */
  expectedSanitizer?: string;
  /** 1-3 line code snippet */
  snippet?: string;
}

export interface SecurityFlowEdge {
  id: string;
  from: string;
  to: string;
  /** Label on the edge describing what data flows */
  dataLabel?: string;
  /** Is the data still tainted at this point? */
  tainted: boolean;
}

// ── Path & Finding ──────────────────────────────────────────────────

export interface SecurityFlowPath {
  id: string;
  title: string;
  severity: 1 | 2 | 3;
  confidence: Confidence;
  owaspCode?: OwaspCode;
  /** Node IDs where sanitiser gaps exist */
  sanitizerGaps: string[];
  nodes: SecurityFlowNode[];
  edges: SecurityFlowEdge[];
  /** New in this PR (not in main) */
  isNew?: boolean;
  /** Can this actually be triggered at runtime? */
  reachable: boolean;
}

export interface SecurityFlowFinding {
  id: string;
  title: string;
  description: string;
  severity: 1 | 2 | 3;
  owaspCode: OwaspCode;
  paths: SecurityFlowPath[];
  sourceFile: string;
  sinkFile: string;
  firstSeen?: string;
  /** Appeared or worsened in current PR */
  prDelta?: boolean;
  /** Remediation guidance */
  fixGuidance?: string;
}

// ── Interaction state ───────────────────────────────────────────────

export interface SecurityFlowSelection {
  pathId: string | null;
  nodeId: string | null;
}
