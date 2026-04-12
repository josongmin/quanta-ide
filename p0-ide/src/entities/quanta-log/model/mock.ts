import type { QuantaLogSnapshot } from "./types";

/**
 * Mock engine event stream. 고정 timestamp를 쓰지 않고 빌드 시점에 상대값을
 * 만들면 스크린샷/Storybook 재현성이 깨지므로, 고정 오프셋(초) 기반으로
 * 계산해서 매 세션 다르게 보이되 일관된 간격을 유지한다.
 */
const now = Date.now();
const s = (offsetSec: number): number => now - offsetSec * 1000;

export const MOCK_QUANTA_LOG: QuantaLogSnapshot = {
  events: [
    {
      id: "q-1",
      at: s(2),
      kind: "impact",
      severity: "warn",
      title: "strategy_selector.py",
      detail: "→ 2 API paths potentially affected · 5 upstream callers",
      meta: "blast-radius: 7 files",
    },
    {
      id: "q-2",
      at: s(4),
      kind: "drift",
      severity: "notice",
      title: "strategy_selector.select(ctx)",
      detail: "signature changed — new param `fallback: Policy | None`",
    },
    {
      id: "q-3",
      at: s(9),
      kind: "graph",
      severity: "info",
      title: "graph rebuilt",
      meta: "312 nodes · 48 edges Δ · 84ms",
    },
    {
      id: "q-4",
      at: s(14),
      kind: "dead",
      severity: "notice",
      title: "_legacy_inference_bridge",
      detail: "no references across 3 modules · last touched 3–6 months ago",
    },
    {
      id: "q-5",
      at: s(22),
      kind: "drift",
      severity: "info",
      title: "routing_policy.py",
      detail: "3 new exports added (resolve, resolveBatch, resolveAsync)",
    },
    {
      id: "q-6",
      at: s(41),
      kind: "sync",
      severity: "info",
      title: "LSP index synced",
      meta: "pyright · ok",
    },
    {
      id: "q-7",
      at: s(68),
      kind: "impact",
      severity: "info",
      title: "audit_store.write",
      detail: "→ 1 test file touches this · no API surface",
    },
    {
      id: "q-8",
      at: s(92),
      kind: "graph",
      severity: "info",
      title: "index primed",
      meta: "first full pass · 2.41s",
    },
  ],
};
