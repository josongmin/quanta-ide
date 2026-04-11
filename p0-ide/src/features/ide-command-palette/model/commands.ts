import type { TFunction } from "i18next";

export interface Command {
  id: string;
  /** i18n key (e.g. ide.cmd.r1) or omit if `label` is literal */
  labelKey?: string;
  label?: string;
  hintKey?: string;
  hint?: string;
  group: "ask" | "action" | "navigate" | "recent";
  shortcut?: string;
  icon?: "spark" | "search" | "fix" | "flow" | "graph" | "time" | "file" | "play";
}

function commandLabel(c: Command, t: TFunction): string {
  if (c.labelKey !== undefined) return t(c.labelKey);
  return c.label ?? "";
}

function commandHint(c: Command, t: TFunction): string {
  if (c.hintKey !== undefined) return t(c.hintKey);
  return c.hint ?? "";
}

export const COMMANDS: Command[] = [
  { id: "r1", labelKey: "ide.cmd.r1", group: "recent", icon: "spark" },
  { id: "r2", labelKey: "ide.cmd.r2", group: "recent", icon: "flow" },
  { id: "r3", labelKey: "ide.cmd.r3", group: "recent", icon: "fix" },
  { id: "a1", labelKey: "ide.cmd.a1", group: "ask", icon: "spark", hintKey: "ide.cmd.hint.selection" },
  { id: "a2", labelKey: "ide.cmd.a2", group: "ask", icon: "play", shortcut: "⌘⇧S" },
  { id: "a3", labelKey: "ide.cmd.a3", group: "ask", icon: "spark" },
  { id: "a4", labelKey: "ide.cmd.a4", group: "ask", icon: "search" },
  { id: "x1", labelKey: "ide.cmd.x1", group: "action", icon: "flow", shortcut: "⌘." },
  { id: "x2", labelKey: "ide.cmd.x2", group: "action", icon: "graph", shortcut: "⌘G" },
  { id: "x3", labelKey: "ide.cmd.x3", group: "action", icon: "spark", shortcut: "⌘B" },
  { id: "x4", labelKey: "ide.cmd.x4", group: "action", icon: "fix", shortcut: "⌘F" },
  { id: "x5", labelKey: "ide.cmd.x5", group: "action", icon: "fix", shortcut: "⌘E" },
  { id: "x6", labelKey: "ide.cmd.x6", group: "action", icon: "time", shortcut: "⌘T" },
  { id: "ownership", labelKey: "ide.cmd.ownership", group: "action", icon: "graph", shortcut: "⌘⇧O" },
  { id: "n1", label: "refund.ts", group: "navigate", icon: "file", hint: "src/payments" },
  { id: "n2", label: "charge.ts", group: "navigate", icon: "file", hint: "src/payments" },
  { id: "n3", label: "ledger.ts", group: "navigate", icon: "file", hint: "src/payments" },
  { id: "n4", label: "session.ts", group: "navigate", icon: "file", hint: "src/auth" },
  { id: "n5", label: "handler.ts", group: "navigate", icon: "file", hint: "src/webhooks" },
];

const GROUP_ORDER: Command["group"][] = ["recent", "ask", "action", "navigate"];

export function filterCommands(
  query: string,
  t: TFunction,
): { group: Command["group"]; label: string; items: Command[] }[] {
  const q = query.trim().toLowerCase();
  const matched = q
    ? COMMANDS.filter((c) => {
        if (commandLabel(c, t).toLowerCase().includes(q)) return true;
        if (commandHint(c, t).toLowerCase().includes(q)) return true;
        if (c.shortcut?.toLowerCase().includes(q) === true) return true;
        return false;
      })
    : COMMANDS;

  const grouped = GROUP_ORDER
    .map((g) => ({
      group: g,
      label: t(`ide.cmd.group.${g}`),
      items: matched.filter((c) => c.group === g),
    }))
    .filter((g) => g.items.length > 0);

  if (q) return grouped.filter((g) => g.group !== "recent");
  return grouped;
}

export function flattenGroups(groups: { items: Command[] }[]): Command[] {
  return groups.flatMap((g) => g.items);
}
