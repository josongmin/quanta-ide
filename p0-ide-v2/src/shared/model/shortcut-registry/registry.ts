import type { ParsedCombo, ShortcutBinding } from "./types";

interface InternalBinding extends ShortcutBinding {
  combo: ParsedCombo;
}

const bindings = new Map<string, InternalBinding>();

/**
 * Parse a human shortcut spec into a canonical combo.
 *
 * Accepts both machine form ("mod+shift+p") and display form ("⌘⇧P",
 * "⌘⌥⇧D", "⌘,"). `mod` maps to ⌘/ctrl depending on platform at dispatch
 * time; the parser only records that `mod` was requested.
 */
export function parseCombo(spec: string): ParsedCombo {
  let mod = false;
  let shift = false;
  let alt = false;
  let key = "";

  // Display form: expand symbols so we can still split on "+".
  const normalised = spec
    .replace(/⌘/g, "mod+")
    .replace(/⇧/g, "shift+")
    .replace(/⌥/g, "alt+")
    .replace(/⌃/g, "ctrl+")
    .trim();

  const parts = normalised.split("+").map((p) => p.trim()).filter(Boolean);
  for (const raw of parts) {
    const token = raw.toLowerCase();
    if (token === "mod" || token === "meta" || token === "cmd" || token === "command") {
      mod = true;
    } else if (token === "ctrl" || token === "control") {
      mod = true;
    } else if (token === "shift") {
      shift = true;
    } else if (token === "alt" || token === "option" || token === "opt") {
      alt = true;
    } else {
      key = token;
    }
  }
  return { mod, shift, alt, key };
}

function eventCombo(e: KeyboardEvent): ParsedCombo {
  return {
    mod: e.metaKey || e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
    key: e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase(),
  };
}

function matches(a: ParsedCombo, b: ParsedCombo, ignoreMods: boolean): boolean {
  if (a.key !== b.key) return false;
  if (ignoreMods) return true;
  return a.mod === b.mod && a.shift === b.shift && a.alt === b.alt;
}

function sorted(): InternalBinding[] {
  return [...bindings.values()].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );
}

export const shortcutRegistry = {
  register(binding: ShortcutBinding): () => void {
    const internal: InternalBinding = {
      ...binding,
      combo: parseCombo(binding.keys),
    };
    bindings.set(binding.id, internal);
    return () => shortcutRegistry.unregister(binding.id);
  },

  unregister(id: string): void {
    bindings.delete(id);
  },

  /**
   * Dispatch a keyboard event against the registry.
   *
   * Returns true if a binding was invoked; callers may use the return
   * value to stop further processing if needed.
   */
  dispatch(e: KeyboardEvent): boolean {
    const incoming = eventCombo(e);
    for (const b of sorted()) {
      if (!matches(b.combo, incoming, b.ignoreMods ?? false)) continue;
      if (b.when && !b.when()) continue;
      b.run(e);
      return true;
    }
    return false;
  },

  list(): readonly ShortcutBinding[] {
    return [...bindings.values()];
  },
};
