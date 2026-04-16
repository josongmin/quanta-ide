import { useSyncExternalStore } from "react";
import { SEED_CHUNKS } from "./sample";
import { scanText } from "./scanner";
import type { ContextChunk, FirewallStats, TrustLevel } from "./types";

interface FirewallState {
  chunks: ContextChunk[];
}

let state: FirewallState = { chunks: SEED_CHUNKS };
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

function id(): string {
  return `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function computeStats(chunks: ContextChunk[]): FirewallStats {
  const active = chunks.filter((c) => !c.dismissed);
  const byTrust: Record<TrustLevel, number> = { trusted: 0, "semi-trusted": 0, untrusted: 0, tainted: 0 };
  const byTrustTokens: Record<TrustLevel, number> = { trusted: 0, "semi-trusted": 0, untrusted: 0, tainted: 0 };
  let suspicious = 0;
  let promoted = 0;
  for (const c of active) {
    byTrust[c.trust] += 1;
    byTrustTokens[c.trust] += c.tokens;
    if (c.scan.suspicious) suspicious += 1;
    if (c.promoted) promoted += 1;
  }
  return { total: active.length, byTrust, byTrustTokens, suspicious, promoted };
}

export const firewallStore = {
  get: (): FirewallState => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },

  addChunk(chunk: Omit<ContextChunk, "id" | "addedAt" | "scan">): ContextChunk {
    const full: ContextChunk = {
      id: id(),
      addedAt: Date.now(),
      scan: scanText(chunk.preview),
      ...chunk,
    };
    state = { chunks: [...state.chunks, full] };
    emit();
    return full;
  },

  promote(chunkId: string) {
    state = {
      chunks: state.chunks.map((c) =>
        c.id === chunkId
          ? { ...c, trust: "trusted" as TrustLevel, promoted: true }
          : c,
      ),
    };
    emit();
  },

  dismiss(chunkId: string) {
    state = {
      chunks: state.chunks.map((c) =>
        c.id === chunkId ? { ...c, dismissed: true } : c,
      ),
    };
    emit();
  },

  rescan(chunkId: string) {
    state = {
      chunks: state.chunks.map((c) =>
        c.id === chunkId ? { ...c, scan: scanText(c.preview) } : c,
      ),
    };
    emit();
  },

  getStats(): FirewallStats {
    return computeStats(state.chunks);
  },

  active(): ContextChunk[] {
    return state.chunks.filter((c) => !c.dismissed);
  },
};

export function useFirewallStore<T>(selector: (s: FirewallState) => T): T {
  return useSyncExternalStore(firewallStore.subscribe, () => selector(state), () => selector(state));
}
