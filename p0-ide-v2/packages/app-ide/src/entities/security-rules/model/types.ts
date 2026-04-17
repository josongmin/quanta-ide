// ── Rule template types ─────────────────────────────────────────────

export type RuleTemplate =
  | "source-to-sink-forbidden"
  | "source-to-sink-requires-sanitizer"
  | "privileged-action-requires-guard"
  | "sensitive-data-no-log"
  | "external-fetch-requires-allowlist"
  | "custom";

export const RULE_TEMPLATE_LABELS: Record<RuleTemplate, string> = {
  "source-to-sink-forbidden": "Source → Sink forbidden",
  "source-to-sink-requires-sanitizer": "Source → Sink requires sanitizer",
  "privileged-action-requires-guard": "Privileged action requires guard",
  "sensitive-data-no-log": "Sensitive data cannot enter logger",
  "external-fetch-requires-allowlist": "External fetch requires allowlist",
  custom: "Custom rule",
};

// ── OWASP ───────────────────────────────────────────────────────────

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

// ── Security Rule ───────────────────────────────────────────────────

export interface SecurityRule {
  id: string;
  title: string;
  description: string;
  template: RuleTemplate;
  severity: 1 | 2 | 3;
  owaspCode: OwaspCode;
  /** Tags from Source/Sink Registry */
  sourceTags: string[];
  sinkTags: string[];
  guardTags: string[];
  /** Scope: which services/modules this applies to */
  scope: string[];
  /** Which pack this rule belongs to */
  packId?: string;
  active: boolean;
  /** Current violation count */
  violationCount: number;
  /** Last time this rule triggered */
  lastTriggered?: string;
  /** Who owns/manages this rule */
  owner?: string;
  /** Suggested fix pattern */
  fixHint?: string;
}

// ── Source/Sink Registry ────────────────────────────────────────────

export type RegistryEntryKind = "source" | "sink" | "sanitizer" | "guard";

export interface RegistryEntry {
  id: string;
  kind: RegistryEntryKind;
  tag: string;
  /** Human-readable label */
  label: string;
  /** Code pattern that identifies this entry */
  pattern: string;
  description: string;
  /** Which languages/frameworks this applies to */
  languages?: string[];
}

// ── Security Pack ───────────────────────────────────────────────────

export interface SecurityPack {
  id: string;
  name: string;
  description: string;
  /** Number of rules in this pack */
  ruleCount: number;
  /** Enabled for this workspace */
  enabled: boolean;
  /** Built-in or custom */
  builtIn: boolean;
  /** OWASP categories covered */
  owaspCoverage: OwaspCode[];
  /** Icon hint */
  icon: string;
}

// ── View state ──────────────────────────────────────────────────────

export type RulesTab = "rules" | "registry" | "packs";
