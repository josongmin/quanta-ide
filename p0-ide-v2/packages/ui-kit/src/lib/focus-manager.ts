const FOCUSABLE_SELECTOR =
  '[tabindex]:not([tabindex="-1"]), button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

// Stack allows nested save()/restore() pairs (e.g. modal inside modal).
const stack: (HTMLElement | null)[] = [];

export const focusManager = {
  save(): void {
    const active = document.activeElement;
    stack.push(active instanceof HTMLElement ? active : null);
  },

  restore(): void {
    const prev = stack.pop();
    if (prev && typeof prev.focus === "function") {
      prev.focus();
    }
  },

  trap(container: HTMLElement): () => void {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // Wrap focus at the ends of the tab order.
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !container.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  },
};
