import type { GutterGlyph } from "@quanta/app-ide/entities/gutter";
import type { InspectorMode } from "@quanta/app-ide/stores/focus-store";

export interface GlyphMeta {
  label: string;
  category: "taint" | "arch" | "health" | "incident" | "ownership" | "behavior";
  mode: InspectorMode;
  actionLabel: string;
  why: string;
  severity: "info" | "warn" | "danger";
}

export const GLYPH_META: Record<GutterGlyph, GlyphMeta> = {
  "taint-source": {
    label: "Taint source",
    category: "taint",
    mode: "flow",
    actionLabel: "Open flow",
    why: "User-controlled input enters the system here.",
    severity: "warn",
  },
  "taint-sink": {
    label: "Taint sink",
    category: "taint",
    mode: "flow",
    actionLabel: "Open flow",
    why: "Unsanitized data reaches a dangerous operation.",
    severity: "danger",
  },
  "taint-through": {
    label: "Taint propagation",
    category: "taint",
    mode: "flow",
    actionLabel: "Open flow",
    why: "Tainted value passes through this line.",
    severity: "info",
  },
  "taint-sanitized": {
    label: "Sanitizer",
    category: "taint",
    mode: "flow",
    actionLabel: "Open flow",
    why: "Validation/sanitization applied before sink.",
    severity: "info",
  },
  "arch-violation": {
    label: "Architecture violation",
    category: "arch",
    mode: "blast",
    actionLabel: "Open blast radius",
    why: "Layer/boundary rule broken — impact spreads inward.",
    severity: "danger",
  },
  "cycle": {
    label: "Dependency cycle",
    category: "arch",
    mode: "blast",
    actionLabel: "Open blast radius",
    why: "Module participates in an import cycle.",
    severity: "warn",
  },
  "god": {
    label: "God class",
    category: "ownership",
    mode: "ownership",
    actionLabel: "Open ownership",
    why: "Too many responsibilities concentrated here.",
    severity: "warn",
  },
  "silo": {
    label: "Bus factor",
    category: "ownership",
    mode: "ownership",
    actionLabel: "Open ownership",
    why: "Only one contributor has touched this recently.",
    severity: "warn",
  },
  "typestate": {
    label: "Typestate",
    category: "behavior",
    mode: "behavior",
    actionLabel: "Open behavior",
    why: "State-machine invariant at risk on this line.",
    severity: "warn",
  },
  "flaky": {
    label: "Flaky",
    category: "behavior",
    mode: "behavior",
    actionLabel: "Open behavior",
    why: "Non-deterministic outcome observed in CI.",
    severity: "info",
  },
  "dead": {
    label: "Dead code",
    category: "health",
    mode: "overview",
    actionLabel: "Open overview",
    why: "No reachable caller in the current graph.",
    severity: "info",
  },
  "incident-match": {
    label: "Incident match",
    category: "incident",
    mode: "incidents",
    actionLabel: "Open incidents",
    why: "Pattern matches a past production incident.",
    severity: "danger",
  },
};
