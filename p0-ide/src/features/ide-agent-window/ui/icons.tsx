/**
 * Icon re-exports — design system migration.
 *
 * IconClose / IconSend / IconChevron / IconPlus are thin wrappers over the
 * shared `@/shared/ui` icon set that preserve the original pixel sizes used
 * throughout this feature (the shared icons default to 14px, while the agent
 * window historically used 10–12px glyphs).
 *
 * `IconChevron` maps to shared `IconChevronDown`.
 *
 * `Dot` is intentionally kept local: the shared `IconDot` uses a different
 * color token (`--color-accent-fg`) and omits the `marginTop: 6` offset that
 * the agent chat bubbles rely on. Swapping it would cause a visual regression.
 * TODO(ds): unify Dot with shared IconDot once the agent bubble layout is
 * refactored.
 */

import {
  IconClose as SharedIconClose,
  IconSend as SharedIconSend,
  IconPlus as SharedIconPlus,
  IconChevronDown as SharedIconChevronDown,
} from "@/shared/ui";

export function IconClose() {
  return <SharedIconClose size={12} strokeWidth={2} />;
}

export function IconSend() {
  return <SharedIconSend size={10} strokeWidth={2.5} />;
}

export function IconChevron() {
  return <SharedIconChevronDown size={10} strokeWidth={2.5} />;
}

export function IconPlus() {
  return <SharedIconPlus size={10} strokeWidth={2.5} />;
}

export function Dot() {
  return (
    <span
      style={{
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: "var(--accent)",
        display: "inline-block",
        flexShrink: 0,
        marginTop: 6,
      }}
    />
  );
}
