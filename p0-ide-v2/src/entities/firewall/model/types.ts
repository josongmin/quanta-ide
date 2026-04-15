export type TrustLevel = "trusted" | "semi-trusted" | "untrusted" | "tainted";

export type ContextSourceKind =
  | "user-prompt"
  | "local-file"
  | "local-doc"
  | "engine-fact"
  | "mcp-response"
  | "web-fetch"
  | "paste"
  | "tool-output";

export interface ContextSource {
  kind: ContextSourceKind;
  label: string;
  verified?: boolean;
  url?: string;
  server?: string;
  path?: string;
  tool?: string;
}

export type ScanPatternId =
  | "override-instruction"
  | "role-switch"
  | "hidden-whitespace"
  | "base64-payload"
  | "url-obfuscation"
  | "executable-intent"
  | "prompt-leak-request";

export interface ScanHit {
  patternId: ScanPatternId;
  confidence: number;
  excerpt?: string;
}

export interface ScanResult {
  suspicious: boolean;
  hits: ScanHit[];
}

export interface ContextChunk {
  id: string;
  addedAt: number;
  turn: number;
  source: ContextSource;
  trust: TrustLevel;
  tokens: number;
  preview: string;
  scan: ScanResult;
  used: boolean;
  promoted?: boolean;
  dismissed?: boolean;
}

export interface FirewallStats {
  total: number;
  byTrust: Record<TrustLevel, number>;
  byTrustTokens: Record<TrustLevel, number>;
  suspicious: number;
  promoted: number;
}

export const PATTERN_DESCRIPTIONS: Record<ScanPatternId, string> = {
  "override-instruction":  "attempts to override prior system instructions",
  "role-switch":           "requests the agent to role-play as another entity",
  "hidden-whitespace":     "uses zero-width or unusual whitespace density",
  "base64-payload":        "contains decodable base64 exceeding size threshold",
  "url-obfuscation":       "URL encoding or non-standard protocol handler",
  "executable-intent":     "phrases indicating destructive shell / SQL commands",
  "prompt-leak-request":   "asks the agent to reveal its system prompt",
};
