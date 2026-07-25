import type { ErrorFlow } from "../model/types";

const orchestrator: ErrorFlow = {
  throws: [
    { id: "t-orc-1", errorType: "TimeoutError",    line: 42,  frame: "orchestrator.dispatch" },
    { id: "t-orc-2", errorType: "ValueError",      line: 78,  frame: "orchestrator.validate" },
    { id: "t-orc-3", errorType: "KeyError",        line: 112, frame: "orchestrator.lookup" },
    { id: "t-orc-4", errorType: "ConnectionError", line: 156, frame: "orchestrator.connect" },
    { id: "t-orc-5", errorType: "RuntimeError",    line: 198, frame: "orchestrator.finalize" },
  ],
  catches: [
    {
      id: "c-orc-1",
      errorTypes: ["TimeoutError"],
      line: 51,
      frame: "orchestrator.dispatch",
      hasFallback: true,
      hasLog: true,
      rethrows: false,
    },
    {
      id: "c-orc-2",
      errorTypes: ["ValueError", "KeyError"],
      line: 88,
      frame: "orchestrator.validate",
      hasFallback: false,
      hasLog: true,
      rethrows: true,
    },
    {
      id: "c-orc-3",
      errorTypes: ["Exception"],
      line: 165,
      frame: "orchestrator.connect",
      hasFallback: false,
      hasLog: false,
      rethrows: false,
    },
    {
      id: "c-orc-4",
      errorTypes: ["ConnectionError"],
      line: 170,
      frame: "orchestrator.run",
      hasFallback: true,
      hasLog: true,
      rethrows: false,
    },
  ],
  paths: [
    {
      id: "p-orc-1",
      throwId: "t-orc-1",
      hops: ["c-orc-1"],
      fate: "caught-fallback",
      finalLine: 51,
      weight: 12,
    },
    {
      id: "p-orc-2",
      throwId: "t-orc-2",
      hops: ["c-orc-2"],
      fate: "rethrown",
      finalLine: 88,
      weight: 6,
    },
    {
      id: "p-orc-3",
      throwId: "t-orc-2",
      hops: ["c-orc-2"],
      fate: "uncaught",
      finalLine: 240,
      weight: 4,
    },
    {
      id: "p-orc-4",
      throwId: "t-orc-3",
      hops: ["c-orc-2"],
      fate: "caught-handled",
      finalLine: 88,
      weight: 8,
    },
    {
      id: "p-orc-5",
      throwId: "t-orc-3",
      hops: [],
      fate: "uncaught",
      finalLine: 112,
      weight: 2,
    },
    {
      id: "p-orc-6",
      throwId: "t-orc-4",
      hops: ["c-orc-3"],
      fate: "caught-swallowed",
      finalLine: 165,
      weight: 5,
    },
    {
      id: "p-orc-7",
      throwId: "t-orc-4",
      hops: ["c-orc-4"],
      fate: "caught-fallback",
      finalLine: 170,
      weight: 9,
    },
    {
      id: "p-orc-8",
      throwId: "t-orc-5",
      hops: ["c-orc-3"],
      fate: "caught-handled",
      finalLine: 165,
      weight: 3,
    },
    {
      id: "p-orc-9",
      throwId: "t-orc-5",
      hops: [],
      fate: "rethrown",
      finalLine: 198,
      weight: 4,
    },
  ],
  completeness: 0.65,
  uncaughtCount: 2,
  swallowedCount: 1,
};

const routingPolicy: ErrorFlow = {
  throws: [
    { id: "t-rp-1", errorType: "PolicyError",   line: 34, frame: "routing_policy.match" },
    { id: "t-rp-2", errorType: "RuntimeError",  line: 71, frame: "routing_policy.apply" },
  ],
  catches: [
    {
      id: "c-rp-1",
      errorTypes: ["PolicyError"],
      line: 40,
      frame: "routing_policy.match",
      hasFallback: true,
      hasLog: true,
      rethrows: false,
    },
    {
      id: "c-rp-2",
      errorTypes: ["RuntimeError", "Exception"],
      line: 80,
      frame: "routing_policy.apply",
      hasFallback: true,
      hasLog: true,
      rethrows: false,
    },
  ],
  paths: [
    {
      id: "p-rp-1",
      throwId: "t-rp-1",
      hops: ["c-rp-1"],
      fate: "caught-fallback",
      finalLine: 40,
      weight: 11,
    },
    {
      id: "p-rp-2",
      throwId: "t-rp-2",
      hops: ["c-rp-2"],
      fate: "caught-handled",
      finalLine: 80,
      weight: 7,
    },
    {
      id: "p-rp-3",
      throwId: "t-rp-2",
      hops: ["c-rp-2"],
      fate: "caught-fallback",
      finalLine: 80,
      weight: 5,
    },
  ],
  completeness: 1.0,
  uncaughtCount: 0,
  swallowedCount: 0,
};

const security: ErrorFlow = {
  throws: [
    { id: "t-sec-1", errorType: "AuthError",       line: 22,  frame: "security.authenticate" },
    { id: "t-sec-2", errorType: "PermissionError", line: 58,  frame: "security.authorize" },
    { id: "t-sec-3", errorType: "TokenExpired",    line: 104, frame: "security.refresh" },
  ],
  catches: [
    {
      id: "c-sec-1",
      errorTypes: ["Exception"],
      line: 110,
      frame: "security.refresh",
      hasFallback: false,
      hasLog: false,
      rethrows: false,
    },
  ],
  paths: [
    {
      id: "p-sec-1",
      throwId: "t-sec-1",
      hops: [],
      fate: "uncaught",
      finalLine: 22,
      weight: 9,
    },
    {
      id: "p-sec-2",
      throwId: "t-sec-2",
      hops: [],
      fate: "uncaught",
      finalLine: 58,
      weight: 7,
    },
    {
      id: "p-sec-3",
      throwId: "t-sec-3",
      hops: ["c-sec-1"],
      fate: "caught-swallowed",
      finalLine: 110,
      weight: 6,
    },
    {
      id: "p-sec-4",
      throwId: "t-sec-3",
      hops: ["c-sec-1"],
      fate: "caught-handled",
      finalLine: 110,
      weight: 2,
    },
  ],
  completeness: 0.4,
  uncaughtCount: 2,
  swallowedCount: 1,
};

export const ERROR_FLOWS: Record<string, ErrorFlow> = {
  "orchestrator.py": orchestrator,
  "routing_policy.py": routingPolicy,
  "security.py": security,
};

export function getErrorFlow(fileName: string): ErrorFlow | null {
  return ERROR_FLOWS[fileName] ?? null;
}
