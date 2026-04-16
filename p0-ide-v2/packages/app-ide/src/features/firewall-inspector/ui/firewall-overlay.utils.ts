import type { ContextChunk, FirewallStats, TrustLevel } from "@quanta/app-ide/entities/firewall";

export const TRUST_ORDER: TrustLevel[] = ["trusted", "semi-trusted", "untrusted", "tainted"];

export const TRUST_LABEL: Record<TrustLevel, string> = {
  trusted: "trusted",
  "semi-trusted": "semi",
  untrusted: "untrusted",
  tainted: "tainted",
};

export const SOURCE_GLYPH: Record<string, string> = {
  "user-prompt":  "U",
  "local-file":   "F",
  "local-doc":    "§",
  "engine-fact":  "E",
  "mcp-response": "M",
  "web-fetch":    "W",
  "paste":        "P",
  "tool-output":  "T",
};

export function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

const EMPTY_TRUST: Record<TrustLevel, number> = {
  trusted: 0, "semi-trusted": 0, untrusted: 0, tainted: 0,
};

export function computeStats(chunks: ContextChunk[]): { active: ContextChunk[]; stats: FirewallStats; totalTokens: number } {
  const active = chunks.filter((c) => !c.dismissed);
  const stats: FirewallStats = {
    total: active.length,
    byTrust: active.reduce(
      (a, c) => ({ ...a, [c.trust]: a[c.trust] + 1 }),
      { ...EMPTY_TRUST } as Record<TrustLevel, number>,
    ),
    byTrustTokens: active.reduce(
      (a, c) => ({ ...a, [c.trust]: a[c.trust] + c.tokens }),
      { ...EMPTY_TRUST } as Record<TrustLevel, number>,
    ),
    suspicious: active.filter((c) => c.scan.suspicious).length,
    promoted: active.filter((c) => c.promoted).length,
  };
  const totalTokens = TRUST_ORDER.reduce((a, t) => a + stats.byTrustTokens[t], 0);
  return { active, stats, totalTokens };
}
