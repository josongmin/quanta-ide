export type DispatchTarget = string;

/** Resolved by IdePage at runtime to inject the active file's proposal. */
let suggestedProposalResolver: (() => unknown) | null = null;

export function setSuggestedProposalResolver(fn: () => unknown): void {
  suggestedProposalResolver = fn;
}

/** Registry: IdePage registers handlers keyed by command id at mount time. */
type CommandHandler = () => void;
const _registry = new Map<string, CommandHandler>();

export function registerCommand(id: string, handler: CommandHandler): void {
  _registry.set(id, handler);
}

export function unregisterCommand(id: string): void {
  _registry.delete(id);
}

/**
 * Dispatch a command action. Call after selecting an item from
 * Command Palette or Context Menu.
 */
export function dispatchCommand(id: DispatchTarget): void {
  // Scroll-only commands (no store dependency)
  if (id === "callgraph" || id === "x2" || id === "refs") {
    scrollInspectorTo("Call Graph");
    return;
  }
  if (id === "blast" || id === "x3") {
    scrollInspectorTo("Blast Radius");
    return;
  }
  if (id === "fix" || id === "x4") {
    if (suggestedProposalResolver) {
      const proposal = suggestedProposalResolver();
      if (proposal) {
        // IdePage registers "fix" as () => openChangeCard(currentProposal)
        const fixHandler = _registry.get("fix");
        if (fixHandler) { fixHandler(); return; }
      }
    }
    scrollInspectorTo("Suggested Fix");
    return;
  }

  // Registry-driven commands (wired by IdePage)
  const handler = _registry.get(id);
  if (handler) {
    handler();
    return;
  }

  // Alias resolution
  const aliases: Record<string, string> = {
    x1: "simulate", a2: "simulate", extract: "simulate", x5: "simulate",
    x6: "history",
    taint: "dataflow",
    n1: "ask", n2: "ask", n3: "ask", n4: "ask", n5: "ask",
  };
  const resolved = aliases[id];
  if (resolved) {
    _registry.get(resolved)?.();
  }
}

function scrollInspectorTo(labelText: string): void {
  const labels = document.querySelectorAll(".ide-label");
  for (const el of labels) {
    if (el.textContent.includes(labelText)) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      const section = el.closest(".ide-inspector-section");
      if (section) {
        section.classList.add("is-flash");
        setTimeout(() => { section.classList.remove("is-flash"); }, 800);
      }
      break;
    }
  }
}
