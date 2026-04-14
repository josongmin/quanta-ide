import type { QuantaEvent } from "../model/types";

export const quantaEvents: QuantaEvent[] = [
  { kind: "drift", ts: "12:04:22", msg: "Symbol shape changed: execute() signature", sym: "orchestrator.py:12" },
  { kind: "impact", ts: "12:04:22", msg: "Blast radius recomputed — 5 files affected" },
  { kind: "dead", ts: "12:02:10", msg: "Dead symbol detected: _select_strategy", sym: "orchestrator.py:26" },
  { kind: "graph", ts: "12:00:03", msg: "Call graph refreshed (2,317 edges)" },
  { kind: "sync", ts: "11:58:40", msg: "Index resync complete — 47 files" },
];
