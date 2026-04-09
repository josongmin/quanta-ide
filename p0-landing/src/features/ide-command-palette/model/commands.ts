export interface Command {
  id: string;
  label: string;
  hint?: string;
  group: "ask" | "action" | "navigate" | "recent";
  shortcut?: string;
  icon?: "spark" | "search" | "fix" | "flow" | "graph" | "time" | "file" | "play";
}

export const COMMANDS: Command[] = [
  // Recent
  { id: "r1", label: "Why is processRefund risky?", group: "recent", icon: "spark" },
  { id: "r2", label: "Show all taint paths", group: "recent", icon: "flow" },
  { id: "r3", label: "Suggest safe refactor", group: "recent", icon: "fix" },

  // Ask
  { id: "a1", label: "Explain this function", group: "ask", icon: "spark", hint: "selection" },
  { id: "a2", label: "Simulate change", group: "ask", icon: "play", shortcut: "⌘⇧S" },
  { id: "a3", label: "Why is this risky?", group: "ask", icon: "spark" },
  { id: "a4", label: "Find similar incidents", group: "ask", icon: "search" },

  // Actions
  { id: "x1", label: "Show data flow", group: "action", icon: "flow", shortcut: "⌘." },
  { id: "x2", label: "Show call graph", group: "action", icon: "graph", shortcut: "⌘G" },
  { id: "x3", label: "Show blast radius", group: "action", icon: "spark", shortcut: "⌘B" },
  { id: "x4", label: "Suggest fix", group: "action", icon: "fix", shortcut: "⌘F" },
  { id: "x5", label: "Extract method", group: "action", icon: "fix", shortcut: "⌘E" },
  { id: "x6", label: "Time travel…", group: "action", icon: "time", shortcut: "⌘T" },

  // Navigate
  { id: "n1", label: "refund.ts", group: "navigate", icon: "file", hint: "src/payments" },
  { id: "n2", label: "charge.ts", group: "navigate", icon: "file", hint: "src/payments" },
  { id: "n3", label: "ledger.ts", group: "navigate", icon: "file", hint: "src/payments" },
  { id: "n4", label: "session.ts", group: "navigate", icon: "file", hint: "src/auth" },
  { id: "n5", label: "handler.ts", group: "navigate", icon: "file", hint: "src/webhooks" },
];

const GROUP_LABELS: Record<Command["group"], string> = {
  recent: "Recent",
  ask: "Ask",
  action: "Actions",
  navigate: "Navigate",
};

const GROUP_ORDER: Command["group"][] = ["recent", "ask", "action", "navigate"];

export function filterCommands(query: string): { group: Command["group"]; label: string; items: Command[] }[] {
  const q = query.trim().toLowerCase();
  const matched = q
    ? COMMANDS.filter((c) => {
        if (c.label.toLowerCase().includes(q)) return true;
        if (c.hint?.toLowerCase().includes(q) === true) return true;
        if (c.shortcut?.toLowerCase().includes(q) === true) return true;
        return false;
      })
    : COMMANDS;

  const grouped = GROUP_ORDER
    .map((g) => ({
      group: g,
      label: GROUP_LABELS[g],
      items: matched.filter((c) => c.group === g),
    }))
    .filter((g) => g.items.length > 0);

  // when searching, hide "recent"
  if (q) return grouped.filter((g) => g.group !== "recent");
  return grouped;
}

export function flattenGroups(groups: { items: Command[] }[]): Command[] {
  return groups.flatMap((g) => g.items);
}
