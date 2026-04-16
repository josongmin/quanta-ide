import { useSyncExternalStore } from "react";
import {
  DEFAULT_RULE_BINDINGS,
  ENGINE_SOURCE,
  VERIFIER_VERSION,
  runVerifier,
} from "./verifiers";
import type {
  AgentClaim,
  ChangeSet,
  ComplianceEvent,
  EvidenceToken,
  RuleBinding,
  SessionStats,
  VerifierId,
} from "./types";

interface ComplianceState {
  events: ComplianceEvent[];
  tokens: EvidenceToken[];
  bindings: readonly RuleBinding[];
}

const SEED_CHANGES: ChangeSet[] = [
  {
    id: "cs-001",
    label: "Extract validate_trace helper",
    files: ["orchestrator.py"],
    author: "agent",
    agentId: "quanta-agent",
    agentClaim: "no-api-break",
    sessionId: "s-live",
  },
  {
    id: "cs-002",
    label: "Add retry-on-429 to fetch_trace",
    files: ["orchestrator.py"],
    author: "agent",
    agentId: "quanta-agent",
    agentClaim: "no-api-break",
    sessionId: "s-live",
  },
];

function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function computeClaimVerified(
  verifierId: VerifierId,
  status: ComplianceEvent["status"],
  claim?: AgentClaim,
): { verified: boolean; isLie: boolean } {
  if (!claim) return { verified: true, isLie: false };
  // Simple mapping: any claim that the patch is "clean" should align with pass on safety verifiers
  const safetyVerifiers: VerifierId[] = [
    "taint.no-sink-without-sanitizer",
    "behavior.no-api-break",
    "arch.no-import-from",
    "type.no-new-errors",
  ];
  if (safetyVerifiers.includes(verifierId)) {
    if (status === "pass") return { verified: true, isLie: false };
    if (status === "fail") return { verified: false, isLie: true };
  }
  return { verified: true, isLie: false };
}

function seed(): ComplianceState {
  const events: ComplianceEvent[] = [];
  const tokens: EvidenceToken[] = [];

  // History for cs-001 — all pass, tokens issued
  for (const b of DEFAULT_RULE_BINDINGS) {
    const r = runVerifier(b.verifierId, SEED_CHANGES[0]);
    const { verified, isLie } = computeClaimVerified(b.verifierId, r.status, SEED_CHANGES[0].agentClaim);
    let tokenId: string | undefined;
    if (r.status === "pass") {
      const t: EvidenceToken = {
        id: nextId("et"),
        changeSetId: SEED_CHANGES[0].id,
        verifierId: b.verifierId,
        status: "pass",
        signedAt: Date.now() - 2 * 60 * 60 * 1000,
        verifierVersion: VERIFIER_VERSION[b.verifierId],
      };
      tokens.push(t);
      tokenId = t.id;
    }
    events.push({
      id: nextId("ce"),
      ts: Date.now() - 2 * 60 * 60 * 1000,
      changeSetId: SEED_CHANGES[0].id,
      changeSetLabel: SEED_CHANGES[0].label,
      ruleId: b.ruleId,
      ruleLabel: b.ruleLabel,
      verifierId: b.verifierId,
      engineSource: ENGINE_SOURCE[b.verifierId],
      status: r.status,
      agentClaim: SEED_CHANGES[0].agentClaim,
      agentClaimVerified: verified,
      isLie,
      violations: r.violations,
      evidenceTokenId: tokenId,
    });
  }

  // History for cs-002 — lie detected: agent claimed no-api-break but behavior diff disagreed
  const liedRule = DEFAULT_RULE_BINDINGS.find((b) => b.verifierId === "behavior.no-api-break")!;
  events.push({
    id: nextId("ce"),
    ts: Date.now() - 1 * 60 * 60 * 1000,
    changeSetId: SEED_CHANGES[1].id,
    changeSetLabel: SEED_CHANGES[1].label,
    ruleId: liedRule.ruleId,
    ruleLabel: liedRule.ruleLabel,
    verifierId: "behavior.no-api-break",
    engineSource: "behavior diff",
    status: "fail",
    agentClaim: "no-api-break",
    agentClaimVerified: false,
    isLie: true,
    violations: [{ file: "orchestrator.py", line: 178, message: "timeout semantics drifted on retry path" }],
  });

  return { events, tokens, bindings: DEFAULT_RULE_BINDINGS };
}

let state: ComplianceState = seed();
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export const complianceStore = {
  get: (): ComplianceState => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },

  submit(change: ChangeSet): ComplianceEvent[] {
    const newEvents: ComplianceEvent[] = [];
    const newTokens: EvidenceToken[] = [];
    for (const b of state.bindings) {
      const r = runVerifier(b.verifierId, change);
      const { verified, isLie } = computeClaimVerified(b.verifierId, r.status, change.agentClaim);
      let tokenId: string | undefined;
      if (r.status === "pass") {
        const t: EvidenceToken = {
          id: nextId("et"),
          changeSetId: change.id,
          verifierId: b.verifierId,
          status: "pass",
          signedAt: Date.now(),
          verifierVersion: VERIFIER_VERSION[b.verifierId],
        };
        newTokens.push(t);
        tokenId = t.id;
      }
      newEvents.push({
        id: nextId("ce"),
        ts: Date.now(),
        changeSetId: change.id,
        changeSetLabel: change.label,
        ruleId: b.ruleId,
        ruleLabel: b.ruleLabel,
        verifierId: b.verifierId,
        engineSource: ENGINE_SOURCE[b.verifierId],
        status: r.status,
        agentClaim: change.agentClaim,
        agentClaimVerified: verified,
        isLie,
        violations: r.violations,
        evidenceTokenId: tokenId,
      });
    }
    state = {
      ...state,
      events: [...state.events, ...newEvents],
      tokens: [...state.tokens, ...newTokens],
    };
    emit();
    return newEvents;
  },

  revokeToken(tokenId: string, reason: string) {
    state = {
      ...state,
      tokens: state.tokens.map((t) =>
        t.id === tokenId ? { ...t, revoked: true, revokedReason: reason } : t,
      ),
    };
    emit();
  },

  getEventsForChange(changeSetId: string): ComplianceEvent[] {
    return state.events.filter((e) => e.changeSetId === changeSetId);
  },

  getRecentEvents(limit = 20): ComplianceEvent[] {
    return [...state.events].sort((a, b) => b.ts - a.ts).slice(0, limit);
  },

  getSessionStats(): SessionStats {
    const total = state.events.length;
    let pass = 0, fail = 0, unknown = 0, liesDetected = 0;
    for (const e of state.events) {
      if (e.status === "pass") pass += 1;
      else if (e.status === "fail") fail += 1;
      else unknown += 1;
      if (e.isLie) liesDetected += 1;
    }
    const tokensIssued = state.tokens.length;
    const tokensRevoked = state.tokens.filter((t) => t.revoked).length;
    return { total, pass, fail, unknown, liesDetected, tokensIssued, tokensRevoked };
  },
};

export function useComplianceStore<T>(selector: (s: ComplianceState) => T): T {
  return useSyncExternalStore(complianceStore.subscribe, () => selector(state), () => selector(state));
}
