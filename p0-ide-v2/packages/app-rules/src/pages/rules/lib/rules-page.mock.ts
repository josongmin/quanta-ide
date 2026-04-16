export const IMPORTABLE = [
  { path: "CLAUDE.md",                          kind: "claude"  as const, detected: true  },
  { path: ".cursorrules",                       kind: "cursor"  as const, detected: true  },
  { path: ".github/copilot-instructions.md",    kind: "copilot" as const, detected: false },
  { path: "AGENT.md",                           kind: "neutral" as const, detected: true  },
];
